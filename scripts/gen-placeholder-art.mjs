// Generates placeholder SVG portraits + backgrounds (film-noir silhouettes).
// Replace any file in public/characters or public/backgrounds with real art later
// (and update the "portrait"/"background" paths in data/public/*.json).
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/%20/g, " ")), "..");
const read = (id) => JSON.parse(fs.readFileSync(path.join(root, "data/public", `${id}.json`), "utf8"));

const STYLE = {
  enzo: "fedora", sal: "fedora", rosa: "woman", lucia: "bun", gino: "bare",
  orourke: "cap", dolly: "woman", frankie: "bare", ace: "fedora", vivian: "bun",
  maria: "bun", haugen: "captain", paulie: "bare", anselm: "priest", jack: "fedora",
};

function portrait(accent, style) {
  const head = `<ellipse cx="100" cy="98" rx="34" ry="42" fill="#0d0c10"/>`;
  const body = `<path d="M30 240 C35 175 65 150 100 150 C135 150 165 175 170 240 Z" fill="#0d0c10"/>`;
  const neck = `<rect x="88" y="128" width="24" height="28" fill="#0d0c10"/>`;
  const hats = {
    fedora: `<path d="M48 72 Q100 58 152 72 L150 78 Q100 70 50 78 Z" fill="#0d0c10"/><path d="M68 72 Q70 38 100 36 Q130 38 132 72 Z" fill="#0d0c10"/><rect x="68" y="62" width="64" height="7" fill="${accent}" opacity="0.8"/>`,
    cap: `<path d="M64 70 Q100 30 136 70 Z" fill="#0d0c10"/><path d="M60 72 L148 72 L156 80 L58 80 Z" fill="#0d0c10"/><circle cx="100" cy="58" r="5" fill="${accent}"/>`,
    captain: `<path d="M62 70 Q100 40 138 70 Z" fill="#0d0c10"/><rect x="60" y="68" width="80" height="9" fill="#0d0c10"/><rect x="62" y="64" width="76" height="4" fill="${accent}"/>`,
    woman: `<path d="M58 110 Q52 50 100 48 Q148 50 142 110 Q150 140 128 150 Q132 100 100 92 Q68 100 72 150 Q50 140 58 110 Z" fill="#0d0c10"/><path d="M60 60 Q100 30 150 55 Q120 50 95 62 Z" fill="${accent}" opacity="0.7"/>`,
    bun: `<circle cx="100" cy="52" r="20" fill="#0d0c10"/>`,
    priest: `<rect x="90" y="146" width="20" height="8" fill="#efe6d2"/>`,
    bare: ``,
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240">
<defs>
<radialGradient id="bg" cx="70%" cy="30%" r="80%"><stop offset="0" stop-color="${accent}" stop-opacity="0.55"/><stop offset="0.6" stop-color="#1a171d"/><stop offset="1" stop-color="#0b0b0d"/></radialGradient>
<linearGradient id="rim" x1="1" x2="0"><stop offset="0" stop-color="${accent}" stop-opacity="0.9"/><stop offset="0.3" stop-color="${accent}" stop-opacity="0"/></linearGradient>
</defs>
<rect width="200" height="240" fill="url(#bg)"/>
<g>${body}${neck}${head}${hats[style] ?? ""}</g>
<g opacity="0.55"><ellipse cx="102" cy="98" rx="34" ry="42" fill="url(#rim)"/><path d="M30 240 C35 175 65 150 100 150 C135 150 165 175 170 240 Z" fill="url(#rim)"/></g>
</svg>`;
}

const SCENES = {
  don: (/* snowy mansion */) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="sky" x2="0" y2="1"><stop offset="0" stop-color="#0d1018"/><stop offset="1" stop-color="#262a35"/></linearGradient>
<radialGradient id="moon" cx="0.8" cy="0.18" r="0.25"><stop offset="0" stop-color="#e8e4d8" stop-opacity="0.5"/><stop offset="1" stop-color="#e8e4d8" stop-opacity="0"/></radialGradient></defs>
<rect width="1600" height="900" fill="url(#sky)"/><rect width="1600" height="900" fill="url(#moon)"/>
<path d="M300 700 L300 380 L520 260 L740 380 L740 300 L800 300 L800 420 L1300 420 L1300 700 Z" fill="#08080b"/>
<path d="M560 260 L560 200 L600 200 L600 290 Z" fill="#08080b"/>
${[[380,450],[460,450],[620,470],[900,480],[1000,480],[1100,480],[1200,480]].map(([x,y],i)=>`<rect x="${x}" y="${y}" width="44" height="64" fill="${i===2?"#c9a227":"#3a3420"}" opacity="${i===2?0.85:0.6}"/>`).join("")}
<path d="M0 760 Q400 700 800 740 T1600 720 L1600 900 L0 900 Z" fill="#d9dde4" opacity="0.9"/>
${Array.from({length:140},(_,i)=>`<circle cx="${(i*137)%1600}" cy="${(i*263)%900}" r="${1+(i%3)}" fill="#fff" opacity="${0.25+((i*7)%10)/20}"/>`).join("")}
</svg>`,
  velvet: () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="w" x2="0" y2="1"><stop offset="0" stop-color="#1a0b10"/><stop offset="1" stop-color="#0b0b0d"/></linearGradient>
<radialGradient id="spot" cx="0.5" cy="0.2" r="0.6"><stop offset="0" stop-color="#b3202c" stop-opacity="0.45"/><stop offset="1" stop-color="#b3202c" stop-opacity="0"/></radialGradient></defs>
<rect width="1600" height="900" fill="url(#w)"/><rect width="1600" height="900" fill="url(#spot)"/>
${Array.from({length:12},(_,i)=>`<path d="M${i*140} 0 Q${i*140+70} 300 ${i*140} 620 L${i*140+70} 620 Q${i*140+140} 300 ${i*140+70} 0 Z" fill="#5a0d14" opacity="0.55"/>`).join("")}
<rect x="0" y="620" width="1600" height="280" fill="#120c0a"/>
<rect x="150" y="600" width="1300" height="30" fill="#3b2412"/>
${Array.from({length:18},(_,i)=>`<rect x="${200+i*68}" y="${520-(i%3)*18}" width="22" height="${80+(i%3)*18}" rx="6" fill="${["#c9a227","#7a1018","#4f8a8b"][i%3]}" opacity="0.55"/>`).join("")}
<text x="800" y="200" text-anchor="middle" font-family="Georgia" font-size="96" fill="#f3c9cc" opacity="0.85" style="letter-spacing:12px">VELVET</text>
</svg>`,
  pier: () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="s" x2="0" y2="1"><stop offset="0" stop-color="#151a1f"/><stop offset="1" stop-color="#2a3138"/></linearGradient>
<linearGradient id="fog" x2="0" y2="1"><stop offset="0" stop-color="#9aa5ad" stop-opacity="0"/><stop offset="1" stop-color="#9aa5ad" stop-opacity="0.45"/></linearGradient></defs>
<rect width="1600" height="900" fill="url(#s)"/>
<path d="M900 560 L960 420 L1400 420 L1460 560 Z" fill="#090b0e"/><rect x="1080" y="300" width="22" height="130" fill="#090b0e"/><rect x="1230" y="330" width="18" height="100" fill="#090b0e"/>
<rect x="100" y="380" width="520" height="260" fill="#0a0c0f"/><path d="M80 380 L360 300 L640 380 Z" fill="#0a0c0f"/>
<text x="360" y="460" text-anchor="middle" font-family="Georgia" font-size="56" fill="#c9a227" opacity="0.6">PIER 9</text>
<rect x="0" y="640" width="1600" height="40" fill="#1a1510"/>${Array.from({length:20},(_,i)=>`<rect x="${i*85}" y="680" width="14" height="220" fill="#100d0a"/>`).join("")}
<circle cx="700" cy="520" r="90" fill="#c9a227" opacity="0.12"/><rect x="694" y="520" width="12" height="120" fill="#090b0e"/>
<rect width="1600" height="900" fill="url(#fog)"/>
</svg>`,
};

for (const id of ["don", "velvet", "pier"]) {
  const pub = read(id);
  const dir = path.join(root, "public/characters", id);
  fs.mkdirSync(dir, { recursive: true });
  for (const s of pub.suspects) {
    fs.writeFileSync(path.join(dir, `${s.id}.svg`), portrait(s.accent, STYLE[s.id] ?? "bare"));
    s.portrait = `/characters/${id}/${s.id}.svg`;
  }
  fs.mkdirSync(path.join(root, "public/backgrounds"), { recursive: true });
  fs.writeFileSync(path.join(root, "public/backgrounds", `${id}.svg`), SCENES[id]());
  pub.background = `/backgrounds/${id}.svg`;
  fs.writeFileSync(path.join(root, "data/public", `${id}.json`), JSON.stringify(pub, null, 2) + "\n");
}
console.log("placeholder art written");
