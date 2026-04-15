const fs = require('fs');
const path = require('path');

// Read all HTML files from games folder
const gamesDir = './games';
const files = fs.readdirSync(gamesDir).filter(f => f.endsWith('.html'));

// Generate game entries
const games = files.map((file, index) => {
  const name = file.replace('.html', '').replace(/_/g, ' ');
  const id = file.replace('.html', '').toLowerCase().replace(/_/g, '-');
  
  return {
    id: id,
    title: name,
    platform: "Web",
    system: "HTML5",
    year: "2024",
    color: "from-red-500 to-blue-500",
    desc: `Play ${name} directly in your browser`,
    icon: "fa-gamepad",
    iconColor: "text-white",
    image: "",
    link: `/games/${file}`
  };
});

// Write to a JSON file
fs.writeFileSync('generated_games.json', JSON.stringify(games, null, 2));
console.log(`Generated ${games.length} game entries!`);
