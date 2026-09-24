export interface BusinessPreset {
  id: string;
  title: string;
  category: string;
  description: string;
  sourceName: string;
  rows: string[];
  columns: {
    name: string;
    examples: Record<number, string>;
  }[];
}

export const BUSINESS_PRESETS: BusinessPreset[] = [
  {
    id: "fec",
    title: "Comptabilité & Facturation",
    category: "Finance",
    description: "Extrayez le N° de facture et le montant débit depuis un export FEC brut.",
    sourceName: "Journal FEC (Comptabilité)",
    rows: [
      "VE | Ventes | VT0001 | 20240131 | 411000 | Clients divers | C0012 | SARL DUPONT & FILS | FA-2024-0001 | 20240131 | Facture FA-2024-0001 - SARL DUPONT | 1 250,00 | 0,00 | AA | 20240215 | 20240131 |  | EUR",
      "AC | Achats | AC0087 | 20240205 | 401000 | Fournisseurs | F0031 | ÉTS MARTIN | FA/2024/87 | 20240203 | Achat fournitures - réf. 12/45 | 980,50 | 0,00 |  |  | 20240205 |  | EUR",
      "BQ | Banque | BQ0142 | 20240229 | 512000 | Banque - compte courant |  |  | REL-02 | 20240229 | Virement client DUPONT | 0,00 | 3 410,90 | BB | 20240301 | 20240229 |  | EUR",
      "OD | Opérations diverses | OD0009 | 20241231 | 681100 | Dotations amortissements |  |  | DOT-2024 | 20241231 | Amortissement matériel (5 ans) | 77,00 | 0,00 |  |  | 20241231 |  | EUR",
      "VE | Ventes | VT0102 | 20250114 | 707000 | Ventes de marchandises | C0007 | LE COMPTOIR | FA-2025-0102 | 20250114 | Facture - lot n°12 000 pièces | 12 000,00 | 0,00 |  |  | 20250114 | 13 200,00 | USD",
      "AC | Achats | AC0203 | 20250220 | 607000 | Achats marchandises | F0002 | IMPORT & CO | FA-2025/203 | 20250218 | Avoir sur facture 198 | -45,90 | 0,00 |  |  | 20250220 |  | EUR",
      "BQ | Banque | BQ0311 | 20250331 | 627000 | Services bancaires |  |  | AGIOS-03 | 20250331 | Agios trimestre 1 | 8,90 | 0,00 |  |  | 20250331 |  | EUR",
      "VE | Ventes | VT0115 | 20250402 | 707000 | Ventes de marchandises | C0012 | SARL DUPONT & FILS | FA-2025-0115 | 20250402 | Facture - remise 10 % | 2 300,00 | 0,00 | CC | 20250430 | 20250402 |  | EUR",
    ],
    columns: [
      {
        name: "N° de pièce",
        examples: { 0: "FA-2024-0001", 1: "FA/2024/87" },
      },
      {
        name: "Débit",
        examples: { 0: "1 250,00", 1: "980,50" },
      },
    ],
  },
  {
    id: "rh",
    title: "RH & Paie",
    category: "Ressources Humaines",
    description: "Isolez les numéros de Sécurité Sociale (NIR) et les emails de collaborateurs.",
    sourceName: "Fichier RH brut",
    rows: [
      "Salarié: Martin Lucas - NIR:1 85 05 75 112 345 67 reçu le 12/01 - Contact: lucas.martin@corp.fr (CDI)",
      "Salarié: Dubois Sophie - NIR:2 92 11 69 456 789 01 reçu le 15/01 - Contact: sophie.dubois@corp.fr (CDI)",
      "Salarié: Bernard Thomas - NIR:1 78 03 33 890 123 45 reçu le 18/01 - Contact: t.bernard@corp.fr (CDD)",
      "Salarié: Petit Camille - NIR:2 01 07 13 234 567 89 reçu le 20/01 - Contact: camille.petit@corp.fr (Stage)",
      "Salarié: Robert Alexandre - NIR:1 95 12 59 678 901 23 reçu le 22/01 - Contact: a.robert@corp.fr (Alternance)",
      "Salarié: Richard Élodie - NIR:2 88 09 92 345 678 90 reçu le 25/01 - Contact: elodie.richard@corp.fr (CDI)",
    ],
    columns: [
      {
        name: "N° Sécurité Sociale (NIR)",
        examples: { 0: "1 85 05 75 112 345 67", 1: "2 92 11 69 456 789 01" },
      },
      {
        name: "Email",
        examples: { 0: "lucas.martin@corp.fr", 1: "sophie.dubois@corp.fr" },
      },
    ],
  },
  {
    id: "web",
    title: "Marketing & Web Tracking",
    category: "Marketing",
    description: "Capturez les codes de campagne UTM et les codes de statut HTTP des requêtes web.",
    sourceName: "Logs Web & URL Tracking",
    rows: [
      "GET /landing-page?utm_source=google&utm_medium=cpc&utm_campaign=black_friday_2026&user_id=8912 HTTP/1.1 200 OK",
      "POST /checkout?utm_source=newsletter&utm_medium=email&utm_campaign=relance_panier&user_id=3401 HTTP/1.1 201 Created",
      "GET /tarifs?utm_source=linkedin&utm_medium=social&utm_campaign=lead_gen_q1&user_id=5623 HTTP/1.1 200 OK",
      "GET /api/v1/auth?utm_source=direct&utm_campaign=onboarding_app&user_id=1109 HTTP/1.1 401 Unauthorized",
      "GET /blog/top-outils?utm_source=google&utm_medium=organic&utm_campaign=seo_expert&user_id=7781 HTTP/1.1 200 OK",
      "POST /webhook?utm_source=stripe&utm_campaign=payment_event&user_id=9920 HTTP/1.1 500 Internal Error",
    ],
    columns: [
      {
        name: "Campagne UTM",
        examples: { 0: "black_friday_2026", 1: "relance_panier" },
      },
      {
        name: "Statut HTTP",
        examples: { 0: "200", 1: "201" },
      },
    ],
  },
  {
    id: "iban",
    title: "Banque & IBAN SEPA",
    category: "Trésorerie",
    description: "Extrayez des identifiants bancaires (IBAN) qu'ils soient formatés avec ou sans espaces.",
    sourceName: "Opérations bancaires",
    rows: [
      "Virement SEPA FR76 3000 6000 0112 3456 7890 189 pour loyer bureau - ref: 99401",
      "Remboursement FR7630006000011234567890189 SEPA reçu instantané - ref: 99402",
      "Virement DE89 3704 0044 0532 0130 00 fact 441 fournisseur - ref: 99403",
      "Prélèvement FR76 1001 2002 3004 5006 7008 901 pour abonnement cloud - ref: 99404",
      "Virement émis DE89370400440532013000 SEPA règlement solde - ref: 99405",
      "Ordre permanent FR76 4000 5000 6007 8009 1000 200 régularisation - ref: 99406",
    ],
    columns: [
      {
        name: "IBAN",
        examples: {
          0: "FR76 3000 6000 0112 3456 7890 189",
          1: "FR7630006000011234567890189",
        },
      },
    ],
  },
];
