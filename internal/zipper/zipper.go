package zipper

import (
	"archive/zip"
	"io"
	"os"
	"path/filepath"
	"strings"
)

func ignored(rel string, rules []string) bool {
	for _, r := range rules {
		r = strings.TrimSpace(r)
		if r == "" || strings.HasPrefix(r, "#") {
			continue
		}
		r = strings.TrimSuffix(r, "/")
		if r == rel || strings.HasPrefix(rel, r+"/") {
			return true
		}
		if strings.HasPrefix(r, "*") && strings.HasSuffix(rel, strings.TrimPrefix(r, "*")) {
			return true
		}
	}
	return false
}
func Build(root string, withNode bool) ([]byte, int, error) {
	rules := []string{".git", ".venix.json", ".venix", ".env"}
	if !withNode {
		rules = append(rules, "node_modules")
	}
	if b, e := os.ReadFile(filepath.Join(root, ".venixignore")); e == nil {
		rules = append(rules, strings.Split(string(b), "\n")...)
	}
	tmp, e := os.CreateTemp("", "venix-*.zip")
	if e != nil {
		return nil, 0, e
	}
	defer os.Remove(tmp.Name())
	zw := zip.NewWriter(tmp)
	n := 0
	e = filepath.Walk(root, func(p string, i os.FileInfo, e error) error {
		if e != nil {
			return e
		}
		if p == root || i.IsDir() {
			return nil
		}
		rel, _ := filepath.Rel(root, p)
		rel = filepath.ToSlash(rel)
		if ignored(rel, rules) {
			return nil
		}
		f, e := zw.Create(rel)
		if e != nil {
			return e
		}
		in, e := os.Open(p)
		if e != nil {
			return e
		}
		_, e = io.Copy(f, in)
		in.Close()
		n++
		return e
	})
	if e == nil {
		e = zw.Close()
	}
	tmp.Close()
	if e != nil {
		return nil, n, e
	}
	b, e := os.ReadFile(tmp.Name())
	return b, n, e
}
