// Test data: RappelConso records in both namings, a fake `fetch`, a fake
// clock and an in-memory memory of the recalls seen. Nothing here goes on the
// network.

/** A record of the current dataset (`rappelconso-v2-gtin-espaces`). */
export function v2Record(overrides = {}) {
  return {
    numero_fiche: '2026-10-0001',
    numero_version: 1,
    categorie_produit: 'Alimentation',
    sous_categorie_produit: 'Lait et produits laitiers',
    marque_produit: 'Marque Repère',
    libelle: 'Yaourt nature 4x125 g',
    identification_produits: '3564700012345$Lot 123$Date limite 2026-11-02',
    distributeurs: 'E.Leclerc',
    motif_rappel: 'Présence de Listeria monocytogenes',
    risques_encourus: 'Listeria monocytogenes (agent responsable de la listériose)',
    conduites_a_tenir_par_le_consommateur: 'Ne plus consommer',
    lien_vers_la_fiche_rappel: 'https://rappel.conso.gouv.fr/fiche-rappel/1/Interne',
    liens_vers_les_images: 'https://rappel.conso.gouv.fr/image/1.jpg',
    date_publication: '2026-10-28T09:00:00+00:00',
    ...overrides,
  };
}

/** A record of the historical dataset (`rappelconso0`). */
export function v1Record(overrides = {}) {
  return {
    reference_fiche: '2026-09-0042',
    ndeg_de_version: 2,
    categorie_de_produit: 'Bébés-Enfants (hors alimentaire)',
    nom_de_la_marque_du_produit: 'Jouets & Co',
    noms_des_modeles_ou_references: 'Hochet lapin',
    identification_des_produits: '12345678',
    distributeurs: 'Tous distributeurs',
    motif_du_rappel: 'Petites pièces détachables',
    risques_encourus_par_le_consommateur: "Risque d'étouffement",
    lien_vers_la_fiche_rappel: 'https://rappel.conso.gouv.fr/fiche-rappel/42/Interne',
    date_de_publication: '2026-09-20',
    ...overrides,
  };
}

/**
 * A `fetch` answering from a function of the URL; records every URL asked.
 * @param {(url: URL) => { status?: number, body?: any }} answer
 */
export function fakeFetch(answer) {
  const calls = [];
  const fetchImpl = async (url) => {
    const parsed = new URL(url);
    calls.push(parsed);
    const { status = 200, body = { results: [] } } = answer(parsed);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    };
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

/** A memory of the recalls seen, kept in the test. */
export function memoryOf(references = null) {
  const memory = {
    saved: references === null ? null : new Set(references),
    async load() {
      return memory.saved === null ? null : new Set(memory.saved);
    },
    async save(refs) {
      memory.saved = new Set(refs);
    },
  };
  return memory;
}

/** A clock the test moves. */
export function fakeClock(iso) {
  let now = new Date(iso);
  const clock = () => new Date(now);
  clock.set = (value) => {
    now = new Date(value);
  };
  clock.advance = (minutes) => {
    now = new Date(now.getTime() + minutes * 60_000);
  };
  return clock;
}
