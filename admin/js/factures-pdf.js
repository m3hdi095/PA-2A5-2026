window.downloadPdf = function(id) {
  if (typeof allFactures === 'undefined') return;
  
  const f = allFactures.find(item => item.id === id);
  if (!f) {
    if (typeof showToast === 'function') showToast("Facture introuvable", "error");
    return;
  }

  if (typeof showToast === 'function') showToast(`Génération du PDF pour la facture ${f.num}...`, 'info');

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFillColor(34, 76, 56);
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(22);
  doc.text("UPCYCLECONNECT", 15, 25);
  
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Gestion Admin - Facture Officielle", 15, 32);

  doc.setTextColor(50, 50, 50);
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Facture N° : ${f.num}`, 15, 60);
  
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Date d'émission : ${f.date}`, 15, 68);
  doc.text(`Statut : ${statusLabel(f.statut).toUpperCase()}`, 15, 74);
  doc.text(`Type de service : ${typeLabel(f.type)}`, 15, 80);

  doc.setFont("Helvetica", "bold");
  doc.text("Destinataire :", 130, 60);
  doc.setFont("Helvetica", "normal");
  doc.text(`${f.client}`, 130, 68);

  doc.setDrawColor(200, 200, 200);
  doc.line(15, 95, 195, 95);

  doc.setFont("Helvetica", "bold");
  doc.text("Description", 15, 110);
  doc.text("Total HT", 100, 110);
  doc.text("TVA (20%)", 140, 110);
  doc.text("Total TTC", 175, 110);
  
  doc.line(15, 114, 195, 114);

  doc.setFont("Helvetica", "normal");
  doc.text(`Prestation de service - ${typeLabel(f.type)}`, 15, 125);
  doc.text(`${Number(f.ht).toFixed(2)} €`, 100, 125);
  doc.text(`${((20 * Number(f.ht)) / 100).toFixed(2)} €`, 140, 125);
  
  doc.setFont("Helvetica", "bold");
  doc.setTextColor(34, 76, 56);
  doc.text(`${f.ttc ? Number(f.ttc).toFixed(2) : Number(f.ht * 1.2).toFixed(2)} €`, 175, 125);

  doc.setDrawColor(200, 200, 200);
  doc.line(15, 270, 195, 270);
  doc.setTextColor(150, 150, 150);
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Merci pour votre confiance. UpcycleConnect - Projet Annuel 2026", 105, 278, { align: "center" });

  doc.save(`Facture_${f.num}.pdf`);
};