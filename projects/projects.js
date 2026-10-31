
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

import { fetchJSON, renderProjects } from '../global.js';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');

renderProjects(projects, projectsContainer, 'h2');

const projectsTitle = document.querySelector('.projects-title');
projectsTitle.textContent = `${projects.length} Projects`;

let query = '';
let selectedIndex = -1;

let searchInput = document.querySelector('.searchBar');

searchInput.addEventListener('change', (event) => {
    query = event.target.value;

    // Filter projects using all metadata
    let filteredProjects = projects.filter((project) => {
        let values = Object.values(project).join('\n').toLowerCase();
        return values.includes(query.toLowerCase());
    });

    // Render filtered projects
    renderProjects(filteredProjects, projectsContainer, 'h2');

    // Update pie chart and legend
    renderPieChart(filteredProjects);
});

function renderPieChart(projectsGiven) {
    // Group projects by year
    let rolledData = d3.rollups(
        projectsGiven,
        (v) => v.length,
        (d) => d.year,
    );

    // Convert grouped data into values and labels
    let data = rolledData.map(([year, count]) => {
        return { value: count, label: year };
    });

    // Generate pie slices
    let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
    let pieGenerator = d3.pie().value((d) => d.value);
    let arcData = pieGenerator(data);

    // Assign colors
    let colors = d3.scaleOrdinal(d3.schemeTableau10);

    // Clear previous chart and legend
    let svg = d3.select('#projects-plot');
    svg.selectAll('path').remove();

    let legend = d3.select('.legend');
    legend.selectAll('li').remove();

    // Render pie chart
    arcData.forEach((d, i) => {
        svg.append('path')
            .attr('d', arcGenerator(d))
            .attr('fill', colors(i))
            .on('click', () => {
                selectedIndex = selectedIndex === i ? -1 : i;

                svg
                    .selectAll('path')
                    .attr('class', (_, idx) =>
                        idx === selectedIndex ? 'selected' : ''
                    );

                legend
                    .selectAll('li')
                    .attr('class', (_, idx) =>
                        idx === selectedIndex ? 'selected' : ''
                    );

                // Filter projects by selected year
                if (selectedIndex === -1) {
                    renderProjects(projects, projectsContainer, 'h2');
                } else {
                    let selectedYear = data[selectedIndex].label;

                    let filteredProjects = projects.filter(
                        (project) => project.year === selectedYear
                    );

                    renderProjects(filteredProjects, projectsContainer, 'h2');
                }
            });
    });

    // Render legend
    arcData.forEach((d, i) => {
        legend.append('li')
            .attr('style', `--color:${colors(i)}`)
            .html(`<span class="swatch"></span> ${d.data.label} <em>(${d.data.value})</em>`);
    });
}

// Render pie chart when the page loads
renderPieChart(projects);
