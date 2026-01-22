const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require('fs');
const path = require('path');

// Mock DOM
const dom = new JSDOM(`<!DOCTYPE html>
<div id="yarnGrid"></div>
<div id="yarnCount"></div>
<div id="dynamic-category-filters"></div>
<div id="allYarns"><span class="category-count"></span></div>
<div id="debug-console"></div>
`);
global.document = dom.window.document;
global.window = dom.window;
global.HTMLElement = dom.window.HTMLElement;

// Mock Fetch
const mockData = JSON.parse(fs.readFileSync(path.join(__dirname, '../dist/site/data/ugurlular-yarns.json'), 'utf8'));
global.fetch = async (url) => {
    console.log(`Fetch called for: ${url}`);
    if (url.includes('ugurlular-yarns.json')) {
        return {
            ok: true,
            status: 200,
            json: async () => mockData
        };
    }
    return { ok: false, status: 404 };
};

// Mock other globals
global.ZeroSelfHeal = {
    checkDataIntegrity: (data) => {
        console.log(`ZeroSelfHeal checked ${data.length} items.`);
    }
};

global.Chart = class {
    constructor() {}
    destroy() {}
};

// Extract logic from yarn-dpp.html (simplified)
let yarnDatabase = [];

async function __ZERO_LOAD_YARNS(){
  const url = "data/ugurlular-yarns.json?v=" + Date.now();
  const res = await fetch(url); // removed cache:no-store for node
  if(!res.ok) throw new Error("Failed to load yarns: " + res.status);
  const data = await res.json();
  if(!Array.isArray(data)) throw new Error("Yarn JSON is not an array");
  
  if(global.ZeroSelfHeal) {
      global.ZeroSelfHeal.checkDataIntegrity(data);
  }
  
  yarnDatabase = data;
  return yarnDatabase;
}

const yarnGrid = document.getElementById('yarnGrid');
const yarnCount = document.getElementById('yarnCount');

function renderYarnCards(yarns) {
    yarnGrid.innerHTML = '';
    if (yarnCount) yarnCount.textContent = yarns.length;
    
    if (yarns.length === 0) {
        yarnGrid.innerHTML = '<p class="no-results">No yarns match your search criteria</p>';
        return;
    }
    
    yarns.forEach(yarn => {
        const card = document.createElement('div');
        card.innerHTML = `Card for ${yarn.name}`;
        yarnGrid.appendChild(card);
    });
}

// Simulate Init
async function init() {
    console.log("Simulating Init...");
    try {
        const yarns = await __ZERO_LOAD_YARNS();
        console.log(`Loaded ${yarns.length} yarns.`);
        renderYarnCards(yarnDatabase);
        console.log(`Grid children: ${yarnGrid.children.length}`);
        if (yarnGrid.children.length === 0) {
             console.log("Grid is empty!");
             console.log("Grid content: " + yarnGrid.innerHTML);
        }
    } catch (e) {
        console.error(e);
    }
}

init();
