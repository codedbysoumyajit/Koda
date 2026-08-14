package gitsvc

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

type GitService struct {
	ctx context.Context
}

func NewGitService() *GitService {
	return &GitService{}
}

func (s *GitService) Startup(ctx context.Context) {
	s.ctx = ctx
}

func (s *GitService) runGit(repoPath string, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = repoPath
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	if err != nil {
		return "", fmt.Errorf("%s: %s", err, strings.TrimSpace(stderr.String()))
	}
	return stdout.String(), nil
}

func (s *GitService) IsGitRepo(repoPath string) bool {
	if repoPath == "" {
		return false
	}
	_, err := s.runGit(repoPath, "rev-parse", "--is-inside-work-tree")
	return err == nil
}

func (s *GitService) GetStatus(repoPath string) (GitStatusResult, error) {
	if repoPath == "" || !s.IsGitRepo(repoPath) {
		return GitStatusResult{IsRepo: false}, nil
	}

	out, err := s.runGit(repoPath, "status", "--porcelain=v1", "-b")
	if err != nil {
		return GitStatusResult{IsRepo: false}, err
	}

	result := GitStatusResult{
		IsRepo:         true,
		StagedFiles:    []GitFile{},
		UnstagedFiles:  []GitFile{},
		UntrackedFiles: []GitFile{},
	}

	lines := strings.Split(out, "\n")
	for _, line := range lines {
		if len(line) == 0 {
			continue
		}

		if strings.HasPrefix(line, "## ") {
			// Branch line: e.g. ## main...origin/main [ahead 1, behind 2]
			branchPart := strings.TrimPrefix(line, "## ")
			if strings.Contains(branchPart, "...") {
				parts := strings.Split(branchPart, "...")
				result.Branch = parts[0]
				if len(parts) > 1 {
					rest := parts[1]
					if strings.Contains(rest, "[ahead ") {
						aheadStr := strings.Split(strings.Split(rest, "[ahead ")[1], "]")[0]
						aheadStr = strings.Split(aheadStr, ",")[0]
						result.Ahead, _ = strconv.Atoi(aheadStr)
					}
					if strings.Contains(rest, "behind ") {
						behindStr := strings.Split(strings.Split(rest, "behind ")[1], "]")[0]
						result.Behind, _ = strconv.Atoi(behindStr)
					}
				}
			} else {
				result.Branch = strings.Split(branchPart, " ")[0]
			}
			continue
		}

		if len(line) < 3 {
			continue
		}

		x := line[0]
		y := line[1]
		path := strings.TrimSpace(line[3:])

		// Handle untracked
		if x == '?' && y == '?' {
			result.UntrackedFiles = append(result.UntrackedFiles, GitFile{
				Path:   path,
				Status: "??",
				Staged: false,
			})
			continue
		}

		// Handle staged changes (index status X)
		if x != ' ' && x != '?' {
			result.StagedFiles = append(result.StagedFiles, GitFile{
				Path:   path,
				Status: string(x),
				Staged: true,
			})
		}

		// Handle unstaged changes (working tree status Y)
		if y != ' ' && y != '?' {
			result.UnstagedFiles = append(result.UnstagedFiles, GitFile{
				Path:   path,
				Status: string(y),
				Staged: false,
			})
		}
	}

	return result, nil
}

func (s *GitService) GetDiff(repoPath, filePath string, staged bool) (GitDiffResult, error) {
	if repoPath == "" || filePath == "" {
		return GitDiffResult{}, fmt.Errorf("empty repoPath or filePath")
	}

	var rawDiff string
	var err error
	if staged {
		rawDiff, err = s.runGit(repoPath, "diff", "--cached", "--", filePath)
	} else {
		rawDiff, err = s.runGit(repoPath, "diff", "--", filePath)
	}
	if err != nil {
		return GitDiffResult{}, err
	}

	// Fetch old content from HEAD / index
	var oldContent string
	if staged {
		oldContent, _ = s.runGit(repoPath, "show", fmt.Sprintf("HEAD:%s", filePath))
	} else {
		oldContent, _ = s.runGit(repoPath, "show", fmt.Sprintf(":%s", filePath))
	}

	// Read current working tree file content
	fullPath := filepath.Join(repoPath, filePath)
	newBytes, _ := os.ReadFile(fullPath)
	newContent := string(newBytes)

	return GitDiffResult{
		FilePath:   filePath,
		OldContent: oldContent,
		NewContent: newContent,
		RawDiff:    rawDiff,
	}, nil
}

func (s *GitService) StageFile(repoPath, filePath string) error {
	_, err := s.runGit(repoPath, "add", "--", filePath)
	return err
}

func (s *GitService) UnstageFile(repoPath, filePath string) error {
	_, err := s.runGit(repoPath, "restore", "--staged", "--", filePath)
	return err
}

func (s *GitService) StageAll(repoPath string) error {
	_, err := s.runGit(repoPath, "add", "-A")
	return err
}

func (s *GitService) UnstageAll(repoPath string) error {
	_, err := s.runGit(repoPath, "restore", "--staged", ".")
	return err
}

func (s *GitService) DiscardChanges(repoPath, filePath string) error {
	_, err := s.runGit(repoPath, "restore", "--", filePath)
	if err != nil {
		// If untracked, delete file
		fullPath := filepath.Join(repoPath, filePath)
		return os.RemoveAll(fullPath)
	}
	return nil
}

func (s *GitService) Commit(repoPath, message string) (string, error) {
	if strings.TrimSpace(message) == "" {
		return "", fmt.Errorf("commit message cannot be empty")
	}
	return s.runGit(repoPath, "commit", "-m", message)
}

func (s *GitService) GetBranches(repoPath string) ([]GitBranchInfo, error) {
	out, err := s.runGit(repoPath, "branch", "-a")
	if err != nil {
		return nil, err
	}

	var branches []GitBranchInfo
	lines := strings.Split(out, "\n")
	for _, l := range lines {
		trimmed := strings.TrimSpace(l)
		if trimmed == "" {
			continue
		}
		isCurrent := strings.HasPrefix(l, "*")
		name := strings.TrimPrefix(trimmed, "* ")
		isRemote := strings.HasPrefix(name, "remotes/")

		branches = append(branches, GitBranchInfo{
			Name:      name,
			IsCurrent: isCurrent,
			IsRemote:  isRemote,
		})
	}
	return branches, nil
}

func (s *GitService) CheckoutBranch(repoPath, branchName string) (string, error) {
	return s.runGit(repoPath, "checkout", branchName)
}

func (s *GitService) Push(repoPath string) (string, error) {
	return s.runGit(repoPath, "push")
}

func (s *GitService) Pull(repoPath string) (string, error) {
	return s.runGit(repoPath, "pull")
}
