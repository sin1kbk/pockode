package watch

import (
	"crypto/rand"
	"encoding/base32"
	"strings"
)

func generateIDWithPrefix(prefix string) string {
	b := make([]byte, 6)
	if _, err := rand.Read(b); err != nil {
		panic("crypto/rand failed: " + err.Error())
	}
	id := strings.ToLower(base32.StdEncoding.EncodeToString(b)[:10])
	return prefix + "_" + id
}
