import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

async function loadData() {
    const data = await d3.csv('loc.csv', (row) => ({
        ...row,
        line: Number(row.line),
        depth: Number(row.depth),
        length: Number(row.length),
        date: new Date(row.date + 'T00:00' + row.timezone),
        datetime: new Date(row.datetime),
    }));

    return data;
}

let data = await loadData();

let commits = d3.groups(data, d => d.commit)
    .map(([id, lines]) => {
        const first = lines[0];

        const commit = {
            id,
            url: `https://github.com/koberhauser/portfolio/commit/${id}`,
            author: first.author,
            date: first.date,
            time: first.time,
            timezone: first.timezone,
            datetime: first.datetime,
            hourFrac: first.datetime.getHours()
                + first.datetime.getMinutes() / 60,
            totalLines: lines.length,
        };

        Object.defineProperty(commit, 'lines', {
            value: lines,
            enumerable: false,
            writable: false,
            configurable: false,
        });

        return commit;
    });

function displayStats() {
    const stats = d3.select('#stats');

    const totalLOC = data.length;
    const totalCommits = commits.length;
    const totalFiles = new Set(data.map(d => d.file)).size;
    const fileLengths = d3.rollups(
        data,
        v => d3.max(v, d => d.line),
        d => d.file
    );
    const averageFileLength = d3.mean(fileLengths, d => d[1]);
    const maximumFileLength = d3.max(fileLengths, d => d[1]);
    const maximumDepth = d3.max(data, d => d.depth);

    stats.html(`
    <h2>Summary</h2>
    <dl class="stats">
        <div>
            <dt>COMMITS</dt>
            <dd>${totalCommits}</dd>
        </div>
        <div>
            <dt>FILES</dt>
            <dd>${totalFiles}</dd>
        </div>
        <div>
            <dt>TOTAL LOC</dt>
            <dd>${totalLOC}</dd>
        </div>
        <div>
            <dt>AVG FILE LENGTH</dt>
            <dd>${averageFileLength.toFixed(1)}</dd>
        </div>
        <div>
            <dt>MAX FILE LENGTH</dt>
            <dd>${maximumFileLength}</dd>
        </div>
        <div>
            <dt>MAX DEPTH</dt>
            <dd>${maximumDepth}</dd>
        </div>
    </dl>
`);
}

function renderTooltipContent(commit) {
    const link = document.getElementById('commit-link');
    const date = document.getElementById('commit-date');
    const time = document.getElementById('commit-time');
    const author = document.getElementById('commit-author');
    const lines = document.getElementById('commit-lines');

    if (Object.keys(commit).length === 0) return;

    link.href = commit.url;
    link.textContent = commit.id;

    date.textContent = commit.datetime?.toLocaleString('en', {
        dateStyle: 'full',
    });

    time.textContent = commit.datetime?.toLocaleString('en', {
        timeStyle: 'short',
    });

    author.textContent = commit.author;
    lines.textContent = commit.totalLines;
}

function updateTooltipVisibility(isVisible) {
    const tooltip = document.getElementById('commit-tooltip');
    tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
    const tooltip = document.getElementById('commit-tooltip');
    tooltip.style.left = `${event.clientX + 12}px`;
    tooltip.style.top = `${event.clientY + 12}px`;
}

function createBrushSelector(svg) {
    // Create brush
    svg.call(d3.brush().on('start brush end', brushed));

    // Raise dots and everything after overlay
    svg.selectAll('.dots, .overlay ~ *').raise();
}

let xScale;
let yScale;


function isCommitSelected(selection, commit) {
    if (!selection) {
        return false;
    }

    const [[x0, y0], [x1, y1]] = selection;

    const x = xScale(commit.datetime);
    const y = yScale(commit.hourFrac);

    return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function renderSelectionCount(selection) {
    const selectedCommits = selection
        ? commits.filter((d) => isCommitSelected(selection, d))
        : [];

    const countElement = document.querySelector('#selection-count');

    countElement.textContent = `${
        selectedCommits.length || 'No'
    } commits selected`;

    return selectedCommits;
}

function renderLanguageBreakdown(selection) {
    const selectedCommits = selection
        ? commits.filter((d) => isCommitSelected(selection, d))
        : [];

    const container = document.getElementById('language-breakdown');

    if (selectedCommits.length === 0) {
        container.innerHTML = '';
        return;
    }

    const requiredCommits = selectedCommits.length ? selectedCommits : commits;
    const lines = requiredCommits.flatMap((d) => d.lines);

    // Count lines per language
    const breakdown = d3.rollup(
        lines,
        (v) => v.length,
        (d) => d.type,
    );

    // Clear previous breakdown
    container.innerHTML = '';

    for (const [language, count] of breakdown) {
        const proportion = count / lines.length;
        const formatted = d3.format('.1~%')(proportion);

        container.innerHTML += `
            <div>
                <dt>${language}</dt>
                <dd>${count} lines (${formatted})</dd>
            </div>
        `;
    }
}

function brushed(event) {
    const selection = event.selection;

    d3.selectAll('.dots circle')
        .classed('selected', (d) => isCommitSelected(selection, d));

    renderSelectionCount(selection);
    renderLanguageBreakdown(selection);
}

function renderScatterPlot(data, commits) {
    const width = 1000;
    const height = 600;

    const margin = { top: 10, right: 10, bottom: 30, left: 20 };

    const usableArea = {
        top: margin.top,
        right: width - margin.right,
        bottom: height - margin.bottom,
        left: margin.left,
        width: width - margin.left - margin.right,
        height: height - margin.top - margin.bottom,
    };

    const svg = d3
        .select('#chart')
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('overflow', 'visible');

    xScale = d3
        .scaleTime()
        .domain(d3.extent(commits, (d) => d.datetime))
        .range([0, width])
        .nice();

    yScale = d3
        .scaleLinear()
        .domain([0, 24])
        .range([height, 0]);

    // Update scales to account for margins
    xScale.range([usableArea.left, usableArea.right]);
    yScale.range([usableArea.bottom, usableArea.top]);

    // Calculate the range of lines edited per commit
    const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);

    // Map lines edited to circle radius
    const rScale = d3.scaleSqrt()
        .domain([minLines, maxLines])
        .range([2, 30]);

    // Sort commits so smaller dots appear on top
    const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

    // Draw dots
    const dots = svg.append('g').attr('class', 'dots');

    dots
    .selectAll('circle')
    .data(sortedCommits)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, commit) => {
        d3.select(event.currentTarget).style('fill-opacity', 1);
        renderTooltipContent(commit);
        updateTooltipVisibility(true);
        updateTooltipPosition(event);
    })
    .on('mouseleave', (event) => {
        d3.select(event.currentTarget).style('fill-opacity', 0.7);
        updateTooltipVisibility(false);
    });


    // Add horizontal gridlines
    const gridlines = svg
        .append('g')
        .attr('class', 'gridlines')
        .attr('transform', `translate(${usableArea.left}, 0)`);

    gridlines.call(
        d3.axisLeft(yScale)
            .tickFormat('')
            .tickSize(-usableArea.width)
    );

    gridlines.selectAll('.tick line')
        .attr('stroke', (d) => {
            return d < 6 || d >= 18 ? '#456b91' : '#a87945';
        })
        .attr('stroke-opacity', 0.45);

    // Create axes
    const xAxis = d3.axisBottom(xScale)
    .tickFormat((d) => {
        if (d.getDate() === 1) {
            return d3.timeFormat('%b')(d);
        }
        return d3.timeFormat('%a %d')(d);
    });

    const yAxis = d3
        .axisLeft(yScale)
        .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00');

    // Add X axis
    svg
        .append('g')
        .attr('transform', `translate(0, ${usableArea.bottom})`)
        .call(xAxis);

    // Add Y axis
    svg
        .append('g')
        .attr('transform', `translate(${usableArea.left}, 0)`)
        .call(yAxis);

    // Initialize brushing
    createBrushSelector(svg);
}

displayStats();
renderScatterPlot(data, commits);