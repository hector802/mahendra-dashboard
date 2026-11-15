/* ==========================================================================
   THE CAST — hand-built SVG presenters.
   Each character is drawn in a 300 x 560 local box, feet at the bottom.
   Mouths, eyes and right arms are hooked up to CSS animations in styles.css.
   ========================================================================== */

const CAST = {
  drench: {
    id: 'drench',
    name: 'Lord Barnaby Drench',
    short: 'Lord Drench',
    first: 'Barnaby',
    title: 'Chief Forecaster & Reluctant Aristocrat',
    honorific: { servant: "m'lord", officer: 'sir' },
    young: 'young man',
    skin: '#e8b896',
  },
  arabella: {
    id: 'arabella',
    name: 'Lady Arabella Fogg',
    short: 'Lady Arabella',
    first: 'Arabella',
    title: 'Society Meteorologist',
    honorific: { servant: "m'lady", officer: "ma'am" },
    young: 'young lady',
    skin: '#f1c6a8',
  },
  wilf: {
    id: 'wilf',
    name: 'Wilf Muckle',
    short: 'Wilf',
    first: 'Wilf',
    title: 'Dogsbody, Umbrella Holder',
    kind: 'servant',
    exclaim: ['Cor blimey', "Ooh, 'eck", 'Gordon Bennett', 'Crikey'],
    words: { me: 'me', myself: 'meself', Mum: 'Me mum', tookOff: "I've already took mine off!" },
    skin: '#d99a74',
  },
  captain: {
    id: 'captain',
    name: 'Captain Rupert Gale-Force',
    short: 'The Captain',
    first: 'Rupert',
    title: 'Officer Commanding Outdoor Reports',
    kind: 'officer',
    exclaim: ['Tally-ho', 'I say', 'Rather', 'Good show'],
    words: { me: 'my', myself: 'myself', Mum: 'Mummy', tookOff: 'Shirt off already, sir! Regimental tradition!' },
    skin: '#f2b8a0',
  },
  nimbus: {
    id: 'nimbus',
    name: 'Professor Ignatius Nimbus',
    short: 'Professor Nimbus',
    first: 'Professor',
    title: 'Department of Applied Guesswork, Univ. of Lower Bogworth',
    skin: '#f3d2bf',
  },
  edna: {
    id: 'edna',
    name: 'Mrs Edna Pratt',
    short: 'Mrs Pratt',
    first: 'Mrs Pratt',
    title: 'Concerned Viewer (Seventeen Letters This Week)',
    skin: '#c98e6a',
  },
  smethwick: {
    id: 'smethwick',
    name: 'Mr Horace Smethwick',
    short: 'Mr Smethwick',
    first: 'Mr Smethwick',
    title: 'Ministry of Weather, Dept. of Unforeseen Precipitation',
    skin: '#8d5a3b',
  },
};

/* ---------- shared body parts ---------- */

function svgFace(o) {
  const skin = o.skin;
  return `
    <ellipse cx="88" cy="142" rx="11" ry="16" fill="${skin}"/>
    <ellipse cx="212" cy="142" rx="11" ry="16" fill="${skin}"/>
    <ellipse cx="150" cy="140" rx="62" ry="72" fill="${skin}"/>
    <ellipse cx="118" cy="168" rx="12" ry="7" fill="#e06b6b" opacity=".22"/>
    <ellipse cx="182" cy="168" rx="12" ry="7" fill="#e06b6b" opacity=".22"/>
    <g class="eyes">
      <ellipse cx="128" cy="140" rx="11" ry="12" fill="#fff"/>
      <ellipse cx="172" cy="140" rx="11" ry="12" fill="#fff"/>
      <circle cx="${129 + (o.look || 0)}" cy="142" r="5.6" fill="${o.iris || '#2a2a33'}"/>
      <circle cx="${173 + (o.look || 0)}" cy="142" r="5.6" fill="${o.iris || '#2a2a33'}"/>
      <circle cx="${131 + (o.look || 0)}" cy="139.5" r="1.8" fill="#fff"/>
      <circle cx="${175 + (o.look || 0)}" cy="139.5" r="1.8" fill="#fff"/>
    </g>
    <path d="${o.brows}" fill="none" stroke="${o.browColor || '#2b1d14'}" stroke-width="${o.browWidth || 4.5}" stroke-linecap="round"/>
    <path d="M150 146 Q160 168 146 172" fill="none" stroke="#9b5f43" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/>
    <g class="mouth">
      <path class="m-closed" d="${o.mouth || 'M134 186 Q150 194 166 186'}" fill="none" stroke="${o.lip || '#7a2e2e'}" stroke-width="4" stroke-linecap="round"/>
      <g class="m-open">
        <ellipse cx="150" cy="188" rx="13" ry="10" fill="#4a1414"/>
        <ellipse cx="150" cy="194" rx="8" ry="4" fill="#d86a6a"/>
        ${o.tooth ? '<rect x="143" y="178" width="7" height="6" rx="1" fill="#fff8e0"/>' : ''}
        ${o.lip && o.lip !== '#7a2e2e' ? `<ellipse cx="150" cy="188" rx="13" ry="10" fill="none" stroke="${o.lip}" stroke-width="3"/>` : ''}
      </g>
    </g>`;
}

function svgBody(o) {
  const lower = o.dress
    ? `<path d="M80 248 Q150 232 220 248 L252 538 Q150 552 48 538 Z" fill="${o.dress}"/>
       <rect x="112" y="536" width="20" height="12" fill="${o.skin}"/>
       <rect x="168" y="536" width="20" height="12" fill="${o.skin}"/>
       <ellipse cx="118" cy="549" rx="24" ry="10" fill="${o.shoes || '#1a1a1a'}"/>
       <ellipse cx="184" cy="549" rx="24" ry="10" fill="${o.shoes || '#1a1a1a'}"/>`
    : `<rect x="96" y="420" width="46" height="122" rx="6" fill="${o.trousers}"/>
       <rect x="158" y="420" width="46" height="122" rx="6" fill="${o.trousers}"/>
       <ellipse cx="112" cy="546" rx="36" ry="13" fill="${o.shoes || '#1a1a1a'}"/>
       <ellipse cx="190" cy="546" rx="36" ry="13" fill="${o.shoes || '#1a1a1a'}"/>
       <path d="M80 248 Q150 232 220 248 L236 432 L64 432 Z" fill="${o.coat}"/>`;
  return `
    <rect x="132" y="196" width="36" height="52" fill="${o.skin}"/>
    ${lower}
    <g class="arm-l">
      <rect x="46" y="252" width="36" height="168" rx="18" fill="${o.sleeve || o.coat || o.dress}"/>
      <circle cx="64" cy="428" r="17" fill="${o.skin}"/>
      ${o.leftHand || ''}
    </g>
    <g class="arm-r">
      <rect x="218" y="252" width="36" height="168" rx="18" fill="${o.sleeve || o.coat || o.dress}"/>
      <circle cx="236" cy="428" r="17" fill="${o.skin}"/>
      ${o.rightHand || ''}
    </g>`;
}

/* ---------- individual characters ---------- */

const DRAW = {
  drench() {
    const skin = CAST.drench.skin;
    return `
      ${svgBody({
        skin, coat: '#1f1a2b', trousers: '#16131f', sleeve: '#2a2240', shoes: '#0d0b12',
      })}
      <path d="M80 248 Q150 232 220 248 L226 300 Q150 286 74 300 Z" fill="#2a2240"/>
      <path d="M150 246 L132 432 M150 246 L168 432" stroke="#c9a659" stroke-width="3" opacity=".8"/>
      <circle cx="150" cy="300" r="5" fill="#c9a659"/><circle cx="150" cy="340" r="5" fill="#c9a659"/><circle cx="150" cy="380" r="5" fill="#c9a659"/>
      <path d="M112 236 Q150 266 188 236 L196 214 Q150 236 104 214 Z" fill="#f4efe2"/>
      ${svgFace({
        skin, iris: '#3b2a1a', look: 2,
        brows: 'M112 122 Q128 114 144 124 M156 120 Q172 104 190 114',
        mouth: 'M136 188 Q152 190 168 182',
      })}
      <path d="M126 178 Q150 168 174 178 Q150 175 126 178 Z" fill="#1b1410" stroke="#1b1410" stroke-width="3" stroke-linejoin="round"/>
      <path d="M138 202 Q150 236 162 202 Q150 210 138 202 Z" fill="#1b1410"/>
      <path d="M86 140 Q82 60 150 56 Q218 60 214 140 Q208 100 184 90 Q162 104 150 120 Q138 104 116 90 Q92 100 86 140 Z" fill="#1b1410"/>
      <path d="M100 96 Q130 72 150 70" fill="none" stroke="#3b3040" stroke-width="3" opacity=".6"/>`;
  },

  arabella() {
    const skin = CAST.arabella.skin;
    const pearls = [...Array(9)].map((_, i) => {
      const t = i / 8, x = 118 + t * 64, y = 232 + Math.sin(t * Math.PI) * 18;
      return `<circle cx="${x}" cy="${y}" r="4.5" fill="#fbf6ea" stroke="#d9cfba" stroke-width="1"/>`;
    }).join('');
    return `
      <ellipse cx="150" cy="128" rx="78" ry="78" fill="#7d2e18"/>
      ${svgBody({
        skin, dress: '#17614f', sleeve: '#17614f', shoes: '#0b3328',
      })}
      <path d="M96 252 Q150 300 204 252 Q150 270 96 252 Z" fill="${skin}"/>
      <path d="M60 470 Q150 500 240 470" stroke="#c9a659" stroke-width="3" fill="none" opacity=".7"/>
      ${pearls}
      ${svgFace({
        skin, iris: '#2f6d55', look: 1, lip: '#b3263a',
        brows: 'M114 120 Q128 112 142 118 M158 118 Q172 112 186 120',
        browColor: '#5b1f10', browWidth: 3.5,
        mouth: 'M136 186 Q150 196 164 186',
      })}
      <path d="M117 128 l-6 -6 M122 126 l-3 -7 M183 128 l6 -6 M178 126 l3 -7" stroke="#1a1a1a" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="88" cy="162" r="5" fill="#fbf6ea"/><circle cx="212" cy="162" r="5" fill="#fbf6ea"/>
      <circle cx="150" cy="56" r="32" fill="#8a3b1f"/>
      <path d="M150 30 Q170 46 160 70" fill="none" stroke="#a54d2a" stroke-width="4" opacity=".7"/>
      <path d="M86 128 Q92 68 150 68 Q208 68 214 128 Q196 92 160 90 Q130 96 112 86 Q100 104 86 128 Z" fill="#8a3b1f"/>
      <path d="M86 128 Q76 160 92 186 Q80 150 96 130 Z" fill="#8a3b1f"/>
      <path d="M214 128 Q224 160 208 186 Q220 150 204 130 Z" fill="#8a3b1f"/>
      <path d="M126 32 l8 10 l4 -12 l6 12 l6 -12 l4 12 l8 -10" fill="none" stroke="#c9a659" stroke-width="3" stroke-linejoin="round"/>`;
  },

  wilf() {
    const skin = CAST.wilf.skin;
    let stubble = '';
    for (let i = 0; i < 28; i++) {
      const a = Math.PI * (0.15 + 0.7 * (i / 27));
      const r = 40 + (i % 3) * 7;
      stubble += `<circle cx="${150 + Math.cos(a) * r}" cy="${150 + Math.sin(a) * r}" r="1.5" fill="#4a3426" opacity=".5"/>`;
    }
    return `
      ${svgBody({
        skin, coat: '#7a6a4f', trousers: '#4d4232', sleeve: '#857358', shoes: '#3a2a1c',
        rightHand: `<g transform="translate(236 428)">
            <path d="M0 14 L0 -150" stroke="#3a2a1c" stroke-width="5"/>
            <path d="M0 14 Q0 30 12 30" fill="none" stroke="#3a2a1c" stroke-width="5" stroke-linecap="round"/>
            <path d="M-64 -214 Q-44 -146 0 -146 Q44 -146 64 -214 Q34 -176 0 -178 Q-34 -176 -64 -214 Z" fill="#2c3e64"/>
            <path d="M0 -150 L-30 -192 M0 -150 L30 -192 M0 -150 L0 -178" stroke="#7d8db0" stroke-width="2"/>
            <path d="M-64 -214 L-70 -222 M64 -214 L58 -226" stroke="#3a2a1c" stroke-width="3"/>
          </g>`,
      })}
      <rect x="140" y="300" width="26" height="26" fill="#6a5a40" transform="rotate(8 153 313)"/>
      <rect x="92" y="372" width="22" height="20" fill="#93805f" transform="rotate(-6 103 382)"/>
      <path d="M64 420 L236 420" stroke="#b39a5b" stroke-width="7"/>
      ${svgFace({
        skin, iris: '#3a2a1a', look: -1, tooth: true,
        brows: 'M112 112 Q128 102 142 112 M158 112 Q172 102 188 112',
        browColor: '#5a3b22',
        mouth: 'M132 184 Q150 198 170 184',
      })}
      ${stubble}
      <path d="M88 118 l-8 14 l14 -4 l-6 14 l12 -6 M212 118 l8 14 l-14 -4 l6 14 l-12 -6" fill="#5a3b22" stroke="#5a3b22" stroke-width="3" stroke-linejoin="round"/>
      <path d="M84 112 Q88 60 150 58 Q212 60 216 112 Z" fill="#6b5a45"/>
      <path d="M84 112 Q150 96 236 116 Q230 128 160 124 Q110 122 84 112 Z" fill="#5a4a37"/>
      <circle cx="104" cy="88" r="7" fill="#f3e9a6"/><circle cx="104" cy="88" r="3" fill="#d9a72c"/>`;
  },

  captain() {
    const skin = CAST.captain.skin;
    return `
      ${svgBody({
        skin, coat: '#b3262c', trousers: '#1a2140', sleeve: '#b3262c', shoes: '#0c0c0c',
      })}
      <path d="M96 420 L104 432 M196 420 L204 432" stroke="#e8c45a" stroke-width="6"/>
      <path d="M100 250 L210 420" stroke="#f3eee3" stroke-width="14"/>
      ${[290, 330, 370, 410].map(y => `<circle cx="150" cy="${y}" r="6" fill="#e8c45a"/>`).join('')}
      <rect x="62" y="240" width="44" height="14" rx="5" fill="#e8c45a"/>
      <rect x="194" y="240" width="44" height="14" rx="5" fill="#e8c45a"/>
      <path d="M62 254 l4 12 M74 254 l2 12 M86 254 l0 12 M98 254 l-2 12 M202 254 l2 12 M214 254 l0 12 M226 254 l-2 12 M236 254 l-4 12" stroke="#e8c45a" stroke-width="2.5"/>
      <rect x="126" y="226" width="48" height="22" fill="#b3262c"/>
      <path d="M126 236 L174 236" stroke="#e8c45a" stroke-width="3"/>
      ${svgFace({
        skin, iris: '#3a6aa8', look: 0,
        brows: 'M112 114 Q128 104 144 112 M156 112 Q172 104 188 114',
        browColor: '#c39a3f',
        mouth: 'M134 190 Q150 198 166 190',
      })}
      <path d="M150 176 Q132 166 116 176 Q100 186 92 166 Q98 192 120 188 Q138 186 150 180 Q162 186 180 188 Q202 192 208 166 Q200 186 184 176 Q168 166 150 176 Z" fill="#c9a04a"/>
      <path d="M88 126 Q84 70 138 62 Q164 24 206 52 Q222 76 212 126 Q204 92 160 90 Q114 92 88 126 Z" fill="#e3c16f"/>
      <path d="M140 64 Q166 40 196 56" fill="none" stroke="#f4dc95" stroke-width="5" stroke-linecap="round"/>`;
  },

  nimbus() {
    const skin = CAST.nimbus.skin;
    return `
      ${svgBody({
        skin, coat: '#7b6b4a', trousers: '#4b4535', sleeve: '#7b6b4a', shoes: '#2a2018',
        rightHand: '<path d="M236 420 L300 300" stroke="#5a3a1c" stroke-width="6" stroke-linecap="round"/><circle cx="300" cy="300" r="6" fill="#e8e0d0"/>',
      })}
      <path d="M90 270 L210 270 M88 310 L212 310 M86 350 L214 350 M84 390 L216 390" stroke="#6a5b3d" stroke-width="2" opacity=".6"/>
      <path d="M110 260 L210 260 M120 280 L120 430 M180 280 L180 430" stroke="#6a5b3d" stroke-width="2" opacity=".4"/>
      <path d="M124 240 L150 300 L176 240 Z" fill="#f4efe2"/>
      <path d="M130 236 L150 248 L130 260 Z M170 236 L150 248 L170 260 Z" fill="#b3262c"/>
      <circle cx="150" cy="248" r="5" fill="#8a1c22"/>
      <rect x="194" y="280" width="18" height="6" fill="#2f5aa8"/><rect x="198" y="276" width="4" height="22" fill="#b3262c"/>
      ${svgFace({
        skin, iris: '#3a5a8a', look: 0,
        brows: 'M108 112 Q124 98 144 114 M156 114 Q176 98 192 112',
        browColor: '#f2f2f2', browWidth: 9,
        mouth: 'M136 188 Q150 184 164 190',
      })}
      <circle cx="128" cy="140" r="19" fill="none" stroke="#2a2a2a" stroke-width="4"/>
      <circle cx="172" cy="140" r="19" fill="none" stroke="#2a2a2a" stroke-width="4"/>
      <path d="M147 140 L153 140 M109 138 L90 132 M191 138 L210 132" stroke="#2a2a2a" stroke-width="4"/>
      <path d="M90 150 Q60 130 78 100 Q58 90 82 70 Q78 50 104 60 Q100 82 96 110 Q86 120 90 150 Z" fill="#f4f4f4"/>
      <path d="M210 150 Q240 130 222 100 Q242 90 218 70 Q222 50 196 60 Q200 82 204 110 Q214 120 210 150 Z" fill="#f4f4f4"/>
      <path d="M140 70 Q146 54 150 68 Q156 50 160 70" fill="none" stroke="#f4f4f4" stroke-width="5" stroke-linecap="round"/>`;
  },

  edna() {
    const skin = CAST.edna.skin;
    const dots = [[110, 82], [140, 70], [172, 74], [196, 92], [96, 108], [126, 96], [160, 92], [204, 120], [92, 136]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#f6e2e8"/>`).join('');
    return `
      ${svgBody({
        skin, dress: '#4f6aa3', sleeve: '#8a7fb8', shoes: '#3a2a2a',
        leftHand: `<g transform="translate(64 410)">
            <path d="M-26 0 Q0 -40 26 0" fill="none" stroke="#151515" stroke-width="5"/>
            <rect x="-34" y="0" width="68" height="48" rx="8" fill="#151515"/>
            <rect x="-6" y="8" width="12" height="7" rx="2" fill="#c9a659"/>
          </g>`,
      })}
      <path d="M80 248 Q150 232 220 248 L226 420 L180 420 L170 262 L130 262 L120 420 L74 420 Z" fill="#8a7fb8"/>
      ${[300, 340, 380].map(y => `<circle cx="174" cy="${y}" r="4" fill="#e6dccf"/>`).join('')}
      ${[[150, 300], [140, 360], [160, 440], [110, 480], [190, 490], [150, 510], [96, 440], [206, 450]]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="#f2c94c" opacity=".85"/><circle cx="${x}" cy="${y}" r="2.4" fill="#d1495b"/>`).join('')}
      ${svgFace({
        skin, iris: '#3a2a1a', look: -2, lip: '#9c2b4a',
        brows: 'M112 124 Q128 114 144 118 M156 118 Q172 114 188 124',
        browColor: '#9a9a9a',
        mouth: 'M138 188 Q150 184 162 188',
      })}
      <path d="M104 132 Q112 120 128 124 Q142 126 146 140 Q140 158 124 158 Q106 156 104 132 Z M196 132 Q188 120 172 124 Q158 126 154 140 Q160 158 176 158 Q194 156 196 132 Z"
        fill="none" stroke="#7a1f3a" stroke-width="4"/>
      <path d="M146 138 L154 138" stroke="#7a1f3a" stroke-width="4"/>
      <circle cx="100" cy="164" r="9" fill="#c9c9c9"/><circle cx="200" cy="164" r="9" fill="#c9c9c9"/>
      <path d="M82 170 Q72 60 150 56 Q228 60 218 170 Q214 112 150 104 Q86 112 82 170 Z" fill="#c44b6a"/>
      ${dots}
      <path d="M86 168 Q96 210 140 214 L150 232 L160 214 Q204 210 214 168 Q206 200 150 206 Q94 200 86 168 Z" fill="#c44b6a"/>
      <path d="M140 216 L128 244 L150 232 L172 244 L160 216 Z" fill="#a73a58"/>`;
  },

  smethwick() {
    const skin = CAST.smethwick.skin;
    const stripes = [...Array(9)].map((_, i) => `<path d="M${82 + i * 18} 250 L${78 + i * 20} 430" stroke="#5b6170" stroke-width="1.5" opacity=".7"/>`).join('');
    return `
      ${svgBody({
        skin, coat: '#2d313b', trousers: '#2a2e37', sleeve: '#2d313b', shoes: '#0a0a0a',
        rightHand: `<g transform="translate(236 428)">
            <path d="M0 -30 L0 118" stroke="#151515" stroke-width="7"/>
            <path d="M0 -30 Q0 -52 -16 -52 Q-30 -52 -30 -38" fill="none" stroke="#151515" stroke-width="7" stroke-linecap="round"/>
            <path d="M-8 -10 L8 -10 L4 100 L-4 100 Z" fill="#232323"/>
          </g>`,
        leftHand: '<rect x="30" y="360" width="56" height="70" rx="3" fill="#a07a4a" stroke="#6b4f2c" stroke-width="3"/><rect x="38" y="370" width="40" height="5" fill="#f4efe2"/><rect x="38" y="382" width="40" height="5" fill="#f4efe2"/>',
      })}
      ${stripes}
      <path d="M118 244 L150 330 L182 244 Z" fill="#f4f6fb"/>
      <path d="M144 252 L156 252 L160 320 L150 336 L140 320 Z" fill="#7a1f2a"/>
      <path d="M118 244 L150 330 L100 270 Z M182 244 L150 330 L200 270 Z" fill="#22252d"/>
      <path d="M180 270 l10 -6 l4 10 Z" fill="#f4f6fb"/>
      ${svgFace({
        skin, iris: '#1e1410', look: 0,
        brows: 'M112 122 L144 122 M156 122 L188 122',
        browColor: '#1d1d1d', browWidth: 5,
        mouth: 'M138 188 L162 188',
        lip: '#4a2020',
      })}
      <path d="M130 178 Q150 172 170 178" fill="none" stroke="#1d1d1d" stroke-width="4" stroke-linecap="round"/>
      <path d="M88 140 Q86 100 104 92 L104 130 Z M212 140 Q214 100 196 92 L196 130 Z" fill="#3a3a3a"/>
      <ellipse cx="150" cy="104" rx="84" ry="14" fill="#111"/>
      <path d="M94 104 Q92 40 150 38 Q208 40 206 104 Z" fill="#161616"/>
      <path d="M95 96 L205 96" stroke="#3a3a3a" stroke-width="6"/>`;
  },
};

function characterSVG(id) {
  return `<g class="char char-${id}">${DRAW[id]()}</g>`;
}
