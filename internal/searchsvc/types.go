package searchsvc

type SearchMatch struct {
	LineNumber  int    `json:"lineNumber"`
	LineContent string `json:"lineContent"`
	StartCol    int    `json:"startCol"`
	EndCol      int    `json:"endCol"`
}

type FileSearchResult struct {
	FilePath string        `json:"filePath"`
	FileName string        `json:"fileName"`
	Matches  []SearchMatch `json:"matches"`
}

type SearchOptions struct {
	Query           string   `json:"query"`
	IsRegex         bool     `json:"isRegex"`
	IsCaseSensitive bool     `json:"isCaseSensitive"`
	IsWholeWord     bool     `json:"isWholeWord"`
	FilesToInclude  string   `json:"filesToInclude"`
	FilesToExclude  string   `json:"filesToExclude"`
	MaxResults      int      `json:"maxResults"`
}

type SearchResponse struct {
	Results      []FileSearchResult `json:"results"`
	TotalMatches int                `json:"totalMatches"`
	TotalFiles   int                `json:"totalFiles"`
	DurationMs   int64              `json:"durationMs"`
}
