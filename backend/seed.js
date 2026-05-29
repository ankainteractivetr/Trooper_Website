// Seeds the database with Caner's existing content, social links and
// the trooper_* images already present in uploads/reel.
// Safe to re-run: it clears social_links + reel_images first and upserts content.
import { pool, q } from './db.js';

// About body is HTML rich text (may contain links). Rendered justified on the
// site and editable from the admin rich-text editor.
const ABOUT = `<p>Hello Everyone. I'm Caner 'Trooper' Kurt. Welcome to my personal web site. I'm a computer programmer and writer hailing from the Republic of Turkiye. This site contains information about me and my work.</p>
<p>I met computers at a very young age thanks to the wonderful video games of the era. When I was a child I kept visiting my father's office to spend more time with his PC. Pretty soon I made up my mind to work with computers and after an impatient time with getting my own PC I started learning programming by myself with game scripting. Soon I started learning a high-level programming language and the language that I picked was Pascal. The first meaningful program that I developed after the "Hello World!" was a phone book application that was running on MS-DOS. After developing basic programs and being comfortable with software development I started learning Delphi and continued developing some more challenging programs such as an image viewer-convertor named <a href="https://www.ankainteractive.com/#talay" target="_blank" rel="noreferrer">Talay</a> and some arcade game clones such as Tic-Tac-Toe, Tetris, Snake, Hangman on Windows platform. After a while with the explosion of the games with 3D graphics I felt myself like a hungry boy who was starving for some cool information. I decided to go further with 3D graphics and started learning C and finally C++ (since they are the industry standard programming languages used in graphics programming). C was very nice, simple and lightweight language with low-level programming capacity but after learning C++ I fell in love with it so I promised myself not to be away from it therefore I sticked to it and started learning Visual Studio, Windows API and DirectX. I developed a casual game which was a Breakout clone. Developing things like a basic renderer from scratch in native way with these technologies was very pleasurable. After developing a 3D graphics viewer named <a href="https://www.ankainteractive.com/#ayzit" target="_blank" rel="noreferrer">Ayz&#305;t</a> which was able to render and animate a 3D Model composed of meshes with animation, I decided to learn OpenGL and gained some knowledge on it and liked it too and favored it because it was cross-platform and my childhood hero John Carmack advocates it! :). I added OpenGL rendering capacity to Ayz&#305;t as an alternative to Direct3D. In the self-taught programmer's journey right from the start the area that he enjoyed the most was graphics &amp; game programming.</p>
<p>I have solid educational and practical background on Software Development, Mathematics and Computer Graphics. My core skills and also the skills that I constantly do my best to improve are The C++ Programming Language, Graphics &amp; Game Programming and Windows Application Development. As a software developer I have work experience with companies and as a freelancer. I started my own video game development company <a href="https://www.ankainteractive.com/" target="_blank" rel="noreferrer">AnkA Interactive</a> and worked as the lead programmer, writer and actor on our games and programs.</p>
<p>Other than work I mostly enjoy music, video games, movies, books, and last but not least my undying passion road trippin'. You can reach me via <a href="mailto:trooper@ankainteractive.com">e-mail</a> any time you wish and also visit my <a href="https://canerbaba387.blogspot.com" target="_blank" rel="noreferrer">blog</a> for more stuff.</p>
<p>Until Next Time!</p>`;

const SOCIAL = [
  { platform: 'LinkedIn',  url: 'https://www.linkedin.com/in/canerbaba387',         icon: 'linkedin.png'  },
  { platform: 'Instagram', url: 'https://www.instagram.com/canerbaba_387_official', icon: 'instagram.png' },
  { platform: 'Twitter',   url: 'https://twitter.com/canerbaba387',                 icon: 'twitter.png'   },
  { platform: 'YouTube',   url: 'https://www.youtube.com/@canerbaba387',            icon: 'youtube.png'   },
  { platform: 'Spotify',   url: 'https://open.spotify.com/user/ankatrooper',        icon: 'spotify.png'   },
  { platform: 'Steam',     url: 'https://steamcommunity.com/id/CanerBaba387',       icon: 'steam.png'     },
  { platform: 'IMDB',      url: 'https://www.imdb.com/user/ur92703026/',            icon: 'imdb.png'      },
];

// Order: trooper_00..
const REEL = [
  { filename: 'trooper_00.jpg',         caption: 'Frame 00' },
  { filename: 'trooper_01.jpg',         caption: 'Frame 01' },
  { filename: 'trooper_02.jpg',         caption: 'Frame 02' },
  { filename: 'trooper_03.jpg',         caption: 'Frame 03' },
  { filename: 'trooper_04.jpg',         caption: 'Frame 04' },
  { filename: 'trooper_05.jpg',         caption: 'Frame 05' },
  { filename: 'trooper_06.jpg',         caption: 'Frame 06' },
  { filename: 'trooper_07.jpg',         caption: 'Frame 07' },
];

async function main() {
  console.log('→ Seeding site_content ...');
  await q(
    `INSERT INTO site_content (id, title, subtitle, about, accent)
     VALUES (1, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE title=VALUES(title), subtitle=VALUES(subtitle),
       about=VALUES(about), accent=VALUES(accent)`,
    [
      "Caner 'Trooper' Kurt",
      'Computer Programmer | Writer',
      ABOUT,
      '#ff2d2d',
    ]
  );

  console.log('→ Seeding social_links ...');
  await q('DELETE FROM social_links');
  let i = 0;
  for (const s of SOCIAL) {
    await q(
      'INSERT INTO social_links (platform, url, icon, sort_order, enabled) VALUES (?,?,?,?,1)',
      [s.platform, s.url, s.icon, i++]
    );
  }

  console.log('→ Seeding reel_images ...');
  await q('DELETE FROM reel_images');
  i = 0;
  for (const r of REEL) {
    await q(
      'INSERT INTO reel_images (filename, caption, sort_order, enabled) VALUES (?,?,?,1)',
      [r.filename, r.caption, i++]
    );
  }

  console.log('✓ Seed complete.');
  await pool.end();
}

main().catch((err) => {
  console.error('✗ Seed failed:', err.message);
  process.exit(1);
});