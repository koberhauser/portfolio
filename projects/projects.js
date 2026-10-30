import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

import { fetchJSON, renderProjects } from '../global.js';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');

renderProjects(projects, projectsContainer, 'h2');

const projectsTitle = document.querySelector('.projects-title');
projectsTitle.textContent = `${projects.length} Projects`;

let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);

let rolledData = d3.rollups(
    projects,
    v => v.length,
    d => d.year
);

console.log(rolledData);

let pieGenerator = d3.pie().value(d => d[1]);
let arcData = pieGenerator(rolledData);

let colors = d3.scaleOrdinal(d3.schemeTableau10);

arcData.forEach((d, i) => {
    d3.select('#projects-plot')
        .append('path')
        .attr('d', arcGenerator(d))
        .attr('fill', colors(i));
});