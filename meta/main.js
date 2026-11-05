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
    </dl>
`);
}

displayStats();