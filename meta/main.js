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

    const xScale = d3
        .scaleTime()
        .domain(d3.extent(commits, (d) => d.datetime))
        .range([0, width])
        .nice();

    const yScale = d3
        .scaleLinear()
        .domain([0, 24])
        .range([height, 0]);

    // Update scales to account for margins
    xScale.range([usableArea.left, usableArea.right]);
    yScale.range([usableArea.bottom, usableArea.top]);

    // Draw dots
    const dots = svg.append('g').attr('class', 'dots');

    dots
        .selectAll('circle')
        .data(commits)
        .join('circle')
        .attr('cx', (d) => xScale(d.datetime))
        .attr('cy', (d) => yScale(d.hourFrac))
        .attr('r', 5)
        .attr('fill', 'steelblue')
        .on('mouseenter', (event, commit) => {
            renderTooltipContent(commit);
            updateTooltipVisibility(true);
            updateTooltipPosition(event);
        })
        .on('mouseleave', () => {
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
}


displayStats();
renderScatterPlot(data, commits);