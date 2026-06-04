package utils

import (
    "image/png"
    "os"

    "github.com/boombuler/barcode"
    "github.com/boombuler/barcode/code128"
)

func GenerateBarcode(data string, filename string) (string, error) {
    raw, err := code128.Encode(data)
    if err != nil {
        return "", err
    }
    scaled, err := barcode.Scale(raw, 300, 100)
    if err != nil {
        return "", err
    }
    file, err := os.Create(filename)
    if err != nil {
        return "", err
    }
    defer file.Close()
    if err = png.Encode(file, scaled); err != nil {
        return "", err
    }
    return filename, nil
}