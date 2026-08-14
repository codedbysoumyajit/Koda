package searchsvc

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

type SearchService struct {
	ctx context.Context
}

func NewSearchService() *SearchService {
	return &SearchService{}
}

func (s *SearchService) Startup(ctx context.Context) {
	s.ctx = ctx
}

func (s *SearchService) Search(workspacePath string, opts SearchOptions) (SearchResponse, error) {
	start := time.Now()
	if workspacePath == "" {
		return SearchResponse{}, fmt.Errorf("no workspace path provided")
	}
	if strings.TrimSpace(opts.Query) == "" {
		return SearchResponse{}, nil
	}

	var pattern *regexp.Regexp
	var err error
	q := opts.Query

	if opts.IsWholeWord {
		if !opts.IsRegex {
			q = regexp.QuoteMeta(q)
		}
		q = `\b` + q + `\b`
	} else if !opts.IsRegex {
		q = regexp.QuoteMeta(q)
	}

	if !opts.IsCaseSensitive {
		q = "(?i)" + q
	}

	pattern, err = regexp.Compile(q)
	if err != nil {
		return SearchResponse{}, fmt.Errorf("invalid search pattern: %w", err)
	}

	if opts.MaxResults <= 0 {
		opts.MaxResults = 2000
	}

	var fileList []string
	_ = filepath.Walk(workspacePath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			name := info.Name()
			if name == ".git" || name == "node_modules" || name == "dist" || name == "build" || name == ".wails" {
				return filepath.SkipDir
			}
			return nil
		}

		// Check include/exclude filters
		rel, _ := filepath.Rel(workspacePath, path)
		if opts.FilesToInclude != "" {
			matched, _ := filepath.Match(opts.FilesToInclude, rel)
			if !matched {
				matchedBase, _ := filepath.Match(opts.FilesToInclude, filepath.Base(path))
				if !matchedBase {
					return nil
				}
			}
		}

		if opts.FilesToExclude != "" {
			matched, _ := filepath.Match(opts.FilesToExclude, rel)
			if matched {
				return nil
			}
			matchedBase, _ := filepath.Match(opts.FilesToExclude, filepath.Base(path))
			if matchedBase {
				return nil
			}
		}

		// Filter out very large binary files (> 10MB)
		if info.Size() > 10*1024*1024 {
			return nil
		}

		fileList = append(fileList, path)
		return nil
	})

	var results []FileSearchResult
	var resultsMu sync.Mutex
	var totalMatches int

	numWorkers := 8
	jobs := make(chan string, len(fileList))
	var wg sync.WaitGroup

	for w := 0; w < numWorkers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for file := range jobs {
				resultsMu.Lock()
				if totalMatches >= opts.MaxResults {
					resultsMu.Unlock()
					continue
				}
				resultsMu.Unlock()

				matches := s.searchFile(file, pattern, opts.MaxResults)
				if len(matches) > 0 {
					resultsMu.Lock()
					if totalMatches < opts.MaxResults {
						rel, _ := filepath.Rel(workspacePath, file)
						results = append(results, FileSearchResult{
							FilePath: rel,
							FileName: filepath.Base(file),
							Matches:  matches,
						})
						totalMatches += len(matches)
					}
					resultsMu.Unlock()
				}
			}
		}()
	}

	for _, file := range fileList {
		jobs <- file
	}
	close(jobs)
	wg.Wait()

	duration := time.Since(start).Milliseconds()

	return SearchResponse{
		Results:      results,
		TotalMatches: totalMatches,
		TotalFiles:   len(results),
		DurationMs:   duration,
	}, nil
}

func (s *SearchService) searchFile(filePath string, pattern *regexp.Regexp, maxMatches int) []SearchMatch {
	f, err := os.Open(filePath)
	if err != nil {
		return nil
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	var matches []SearchMatch
	lineNum := 1

	for scanner.Scan() {
		line := scanner.Text()
		locs := pattern.FindAllStringIndex(line, -1)
		for _, loc := range locs {
			matches = append(matches, SearchMatch{
				LineNumber:  lineNum,
				LineContent: strings.TrimSpace(line),
				StartCol:    loc[0] + 1,
				EndCol:      loc[1] + 1,
			})
			if len(matches) >= maxMatches {
				return matches
			}
		}
		lineNum++
	}

	return matches
}

func (s *SearchService) ReplaceInFile(workspacePath, relFilePath, query, replacement string, isRegex, isCaseSensitive, isWholeWord bool) error {
	fullPath := filepath.Join(workspacePath, relFilePath)
	data, err := os.ReadFile(fullPath)
	if err != nil {
		return err
	}

	q := query
	if isWholeWord {
		if !isRegex {
			q = regexp.QuoteMeta(q)
		}
		q = `\b` + q + `\b`
	} else if !isRegex {
		q = regexp.QuoteMeta(q)
	}

	if !isCaseSensitive {
		q = "(?i)" + q
	}

	pattern, err := regexp.Compile(q)
	if err != nil {
		return err
	}

	replaced := pattern.ReplaceAllString(string(data), replacement)
	return os.WriteFile(fullPath, []byte(replaced), 0644)
}

func (s *SearchService) ReplaceAll(workspacePath, query, replacement string, isRegex, isCaseSensitive, isWholeWord bool, files []string) error {
	for _, rel := range files {
		_ = s.ReplaceInFile(workspacePath, rel, query, replacement, isRegex, isCaseSensitive, isWholeWord)
	}
	return nil
}
