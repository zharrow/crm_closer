/**
 * Le garde-fou de la palette.
 *
 *     node scripts/contraste.mjs
 *
 * DESIGN.md annonce des planchers AAA (7:1) et les écrit noir sur blanc dans
 * un tableau. Un tableau de chiffres qu'on ne peut pas rejouer se périme au
 * premier ajustement, et il se périme *en silence* : la valeur reste écrite,
 * elle cesse simplement d'être vraie.
 *
 * Ce fichier vivait dans le scratchpad d'une session. Il est ici parce que la
 * palette a grossi — quatre valeurs de nappe, cinq tons avec leur encre, deux
 * teintes, quatre pastilles de canal — et que la refaire de mémoire n'est plus
 * une option raisonnable.
 *
 * Les valeurs doivent rester le miroir exact de `src/app/globals.css`. Si tu
 * touches à l'un, touche à l'autre dans le même commit.
 */

const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

const luminance = (hex) => {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (hi + 0.05) / (lo + 0.05);
};

/** Compose une couleur translucide sur son fond — `text-on-ink/70` et consorts. */
const over = (fg, bg, alpha) => {
  const px = (h) => [0, 2, 4].map((i) => parseInt(h.replace("#", "").slice(i, i + 2), 16));
  const [f, b] = [px(fg), px(bg)];
  return (
    "#" +
    [0, 1, 2]
      .map((i) => Math.round(alpha * f[i] + (1 - alpha) * b[i]).toString(16).padStart(2, "0"))
      .join("")
  );
};

const THEMES = {
  clair: {
    /* Les quatre valeurs de la nappe. Le pire fond du thème clair est le halo
       froid, pas le sol : les halos éclaircissent, mais le froid est le moins
       clair des quatre. Tout ce qui s'écrit à même la page est mesuré dessus. */
    nappe: ["#EDEDE6", "#DFEAFC", "#FEEFCF", "#E4F4BC"],
    surfaces: ["#FFFFFF"], // carte et fenêtre
    foreground: "#131A18",
    mutedForeground: "#454E48",
    primary: "#2534C4",
    success: "#37500F",
    warning: "#654707",
    destructive: "#8E2819",
    border: "#A4A79E",
    input: "#646963",
    tones: {
      ink: ["#101A17", "#EFF3EA"],
      cobalt: ["#2534C4", "#FFFFFF"],
      zest: ["#CFF255", "#101A17"],
      amber: ["#F9CE4C", "#101A17"],
      clay: ["#F08A63", "#101A17"],
    },
    tints: { amber: "#FBEECB", clay: "#FBDCCE" },
    chips: {
      email: ["#D6E6F2", "#1C4A63"],
      phone: ["#F6DFD3", "#75381D"],
      linkedin: ["#DEDCF2", "#3E3A78"],
      neutral: ["#E2E3DC", "#131A18"],
    },
  },
  sombre: {
    /* À l'envers : les halos éclaircissent la nappe, donc le pire fond du
       sombre est le plus clair des quatre. */
    nappe: ["#0A0F0E", "#16232E", "#241A14", "#1A2612"],
    surfaces: ["#151D1A", "#1C2622"],
    foreground: "#E8EDE4",
    mutedForeground: "#A9B5AC",
    primary: "#A3ADFF",
    success: "#B4D96A",
    warning: "#E3BC63",
    destructive: "#F79A87",
    border: "#4E5A54",
    input: "#828E86",
    tones: {
      ink: ["#1F2B27", "#EFF3EA"],
      cobalt: ["#3341CB", "#FFFFFF"],
      zest: ["#C6EC55", "#0F1614"],
      amber: ["#EFC259", "#0F1614"],
      clay: ["#E88760", "#0F1614"],
    },
    tints: { amber: "#3A2E10", clay: "#3A1E12" },
    chips: {
      email: ["#12262F", "#A9D2EA"],
      phone: ["#2B1810", "#F0B394"],
      linkedin: ["#1D1B33", "#BDB6EE"],
      neutral: ["#222B27", "#E8EDE4"],
    },
  },
};

/**
 * Les planchers. `--primary` vise 6:1 et non 7 : il ne sert en texte que sur
 * des liens et des libellés courts, jamais sur de la prose. `--border` sépare,
 * il ne désigne pas — d'où son seuil très bas, et l'écart délibéré avec
 * `--input`, qui lui borne un composant (règle 1.4.11).
 */
function checks(t) {
  const fonds = [...t.nappe, ...t.surfaces];
  const rows = [
    ["texte principal", t.foreground, fonds, 7],
    ["texte de second plan", t.mutedForeground, fonds, 7],
    ["primary en texte", t.primary, fonds, 6],
    ["success en texte", t.success, fonds, 7],
    ["warning en texte", t.warning, fonds, 7],
    ["destructive en texte", t.destructive, fonds, 7],
    ["bordure de champ", t.input, fonds, 4.5],
    ["bordure de carte", t.border, fonds, 2],
  ];

  for (const [name, [surface, encre]] of Object.entries(t.tones)) {
    rows.push([`encre sur ton ${name}`, encre, [surface], 7]);
  }
  /* Le rail rend ses entrées inactives en encre voilée. L'opacité se compose
     sur le ton, donc elle se mesure sur le résultat composé — pas sur l'encre
     pleine, qui passerait toujours. */
  rows.push([
    "libellé effacé du rail (/70)",
    over(t.tones.ink[1], t.tones.ink[0], 0.7),
    [t.tones.ink[0]],
    7,
  ]);
  for (const [name, tint] of Object.entries(t.tints)) {
    rows.push([`texte sur teinte ${name}`, t.foreground, [tint], 7]);
  }
  for (const [name, [surface, encre]] of Object.entries(t.chips)) {
    rows.push([`pastille ${name}`, encre, [surface], 7]);
  }
  return rows;
}

let failures = 0;

for (const [label, theme] of Object.entries(THEMES)) {
  console.log(`\n── ${label} ──`);
  for (const [name, fg, bgs, floor] of checks(theme)) {
    const worst = Math.min(...bgs.map((bg) => ratio(fg, bg)));
    const ok = worst >= floor;
    if (!ok) failures++;
    console.log(
      `${ok ? "ok  " : "ÉCHEC"} ${name.padEnd(30)} ${worst.toFixed(2).padStart(6)}:1  (plancher ${floor})`,
    );
  }
}

console.log(
  failures
    ? `\n${failures} valeur(s) sous le plancher — corrige globals.css *et* le tableau de DESIGN.md.`
    : "\nTous les planchers tiennent.",
);

process.exit(failures ? 1 : 0);
