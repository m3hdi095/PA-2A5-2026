package utils

import (
    "fmt"

    "github.com/jung-kurt/gofpdf/v2"
)

type FactureData struct {
    Numero     string
    Date       string
    NomClient  string
    MontantHT  float64
    TVA        float64
    MontantTTC float64
}

func GenerateInvoice(data FactureData, filename string) error {
    pdf := gofpdf.New("P", "mm", "A4", "")
    pdf.AddPage()
    pdf.SetFont("Arial", "B", 16)
    pdf.Cell(40, 10, "UpcycleConnect - Facture")
    pdf.Ln(12)
    pdf.SetFont("Arial", "", 12)
    pdf.Cell(40, 10, fmt.Sprintf("N° : %s", data.Numero))
    pdf.Ln(8)
    pdf.Cell(40, 10, fmt.Sprintf("Date : %s", data.Date))
    pdf.Ln(8)
    pdf.Cell(40, 10, fmt.Sprintf("Client : %s", data.NomClient))
    pdf.Ln(12)
    pdf.Cell(40, 10, fmt.Sprintf("Montant HT : %.2f €", data.MontantHT))
    pdf.Ln(8)
    pdf.Cell(40, 10, fmt.Sprintf("TVA (%.0f%%) : %.2f €", data.TVA, data.MontantHT*data.TVA/100))
    pdf.Ln(8)
    pdf.SetFont("Arial", "B", 12)
    pdf.Cell(40, 10, fmt.Sprintf("TOTAL TTC : %.2f €", data.MontantTTC))
    return pdf.OutputFileAndClose(filename)
}