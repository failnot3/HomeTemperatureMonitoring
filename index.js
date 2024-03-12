// Dependencies
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const http = require('http');
const url = require('url');
const Chart = require('chart.js');

// Inside and outside temperature endpoints
const INSIDE_TEMPERATURE_ENDPOINT = 'http://192.168.5.116/temperaturec';
const OUTSIDE_TEMPERATURE_ENDPOINT = 'https://api.open-meteo.com/v1/forecast?latitude=<REPLACE-WITH-YOUR-COORDONATES>&longitude=<REPLACE-WITH-YOUR-COORDONATES>&current=temperature_2m';

// Database setup
const DATABASE_FILE = './db/tempreading.db';
const db = new sqlite3.Database(DATABASE_FILE, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        // console.log('Connected to the database.');
        createTemperatureTable();
    }
});

// Function to create the temperature table (if it doesn't exist)
function createTemperatureTable() {
    db.run(`CREATE TABLE IF NOT EXISTS tempreading (inside_temp REAL, outside_temp REAL, created_at TEXT)`, (err) => {
        if (err) {
            console.error('Error creating temperature table:', err);
        }
    });
}

// Function to insert temperature data into the database
function insertTemperature(insideTemp, outsideTemp) {
    const timestamp = new Date().toISOString();
    db.run('INSERT INTO tempreading (inside_temp, outside_temp, created_at) VALUES (?, ?, ?)', [insideTemp, outsideTemp, timestamp], (err) => {
        if (err) {
            console.error('Error inserting temperature:', err);
        } else {
            // console.log(`Temperature Inside: ${insideTemp} C, Outside: ${outsideTemp} C inserted at ${timestamp}`);
        }
    });
}

// Scheduled data fetching every X minutes - 15 * 60 * 1000 = - 15 MIN | 900000 - 15 MIN| 1200000 - 20 MIN
const FETCH_INTERVAL = 1200000; 
setInterval(fetchAndStoreTemperatures, FETCH_INTERVAL);

// Function to fetch and store temperature data
function fetchAndStoreTemperatures() {
    getInsideTemperature()
        .then(insideTemp => {
            getOutsideTemperature()
                .then(outsideTemp => {
                    insertTemperature(insideTemp, outsideTemp);
                })
                .catch(error => {
                    logError(error.message);
                });
        })
        .catch(error => {
            logError(error.message);
        });
}

// Function to fetch inside temperature
function getInsideTemperature() {
    return new Promise((resolve, reject) => {
        fetch(INSIDE_TEMPERATURE_ENDPOINT)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Error fetching inside temperature: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                resolve(data);
            })
            .catch(error => {
                reject(error);
            });
    });
}

// Function to fetch outside temperature
function getOutsideTemperature() {
    return new Promise((resolve, reject) => {
        fetch(OUTSIDE_TEMPERATURE_ENDPOINT)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Error fetching outside temperature: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                resolve(data.current.temperature_2m);
            })
            .catch(error => {
                reject(error);
            });
    });
}

// Function to log errors to a file
function logError(errorMessage) {
    const logEntry = `${new Date()},${errorMessage}\n`;
    fs.appendFile('./log/errorsLog.csv', logEntry, (err) => {
        if (err) {
            console.error('Error writing to error log:', err);
        }
    });
}

// Server setup
const server = http.createServer((req, res) => {
    const { pathname } = url.parse(req.url, true);

    switch (pathname) {
        case '/':
            displayCurrentTemperature(res);
            break;
        case '/history':
            displayTemperatureHistory(res);
            break;
        case '/graph':
            displayTemperatureGraph(res);
            break;
        default:
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 - Not Found');
    }
});

server.listen(8513, () => {
    console.log(`${new Date()} Server running at http://localhost:8513/`);
});

// Function to display current temperature
function displayCurrentTemperature(res) {
    db.get('SELECT * FROM tempreading WHERE rowid=(SELECT max(rowid) FROM tempreading);', (err, row) => {
        if (err) {
            console.error('Error retrieving current temperature:', err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('500 - Internal Server Error');
        } else if (!row) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('No temperature data available');
        } else {
            const html = `<html><head><title>Current Temperature</title><style>body { font-family: Arial, sans-serif; background-color:#483D8B; text-align: center;} 
            nav { background-color: #6A5ACD; color: #fff; padding-top: 10px; padding-bottom: 10px;} 
            nav a { color: #fff; text-decoration: none; padding: 10px; } 
            nav a:hover { background-color: #4B0082; }
            p {color: #E6E6FA; font-size:3em;} h1{color: #E6E6FA;} 
            .wrapper {
                position: absolute;
                top: 50%;
                left: 50%;
                width: 50em;
                height: 25em;
                margin: -4em 0 0 -24em;
            }
            .widget {
                position: relative;
                display: inline-block;
                box-sizing: content-box;
                width: 18em;
                height: 18em;
                padding: 42px;
                border-radius: 8px;
                background-color: #E6E6FA;
                box-shadow: 0 0 1.5em #1c83b0;
            }
            .icon {
                font-family: 'FontAwesome';
                float: right;
            }
            .widget > div {
                font-weight: 300;
                position: absolute;
                bottom: 3.875em;
                color: #79b0c9;
            }
            .degree {
                font-size: 6em;
            }
            .country {
                font-size: 3em;
                line-height: 10px;
                color: #cbcbcb;
            }
</style></head><body><h1>Current Temperature</h1><nav><a href="/">Current Temperature</a> | <a href="/history">Temperature History</a> | <a href="/graph">Temperature Graph</a></nav>
<div class='wrapper'>
<div class='widget' style='margin-right: 2.4em;'>
  <i class='fa fa-4x' style='color: #FFA500;'></i>
  <div>
    <div class='degree'>${Math.trunc(row.inside_temp)} C</div>
    <div class='country'><em>Inside</em></div>
  </div>
</div>
<div class='widget'>
  <i class='fa fa-4x' style='color: #82b2e4;'></i>
  <div>
    <div class='degree'>${Math.trunc(row.outside_temp)} C</div>
    <div class='country'><em>Outside</em></div>
  </div>
</div>
</div></body></html>`;
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
        }
    });
}

// Function to display temperature history
function displayTemperatureHistory(res) {
    db.all('SELECT inside_temp, outside_temp, created_at FROM tempreading ORDER BY created_at DESC', (err, rows) => {
        if (err) {
            console.error('Error retrieving temperature history:', err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('500 - Internal Server Error');
        } else if (!rows.length) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('No temperature data available');
        } else {
            let tableRows = rows.map(row => {
                const timestamp = new Date(row.created_at);
                const formattedTimestamp = new Intl.DateTimeFormat('bg-BG', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    timeZone: 'EET'
                }).format(timestamp).replace(',', '_').replace(/\//g, '-');

                return `<tr><td>${formattedTimestamp}</td><td>${row.inside_temp} C</td><td>${row.outside_temp} C</td></tr>`;
            }).join('');
            const html = `<html><head><title>Temperature History</title><style>body { font-family: Arial, sans-serif; text-align: center;} nav { background-color: #3b74c4; color: #fff; padding: 10px; } nav a { color: #fff; text-decoration: none; padding: 10px; } nav a:hover { background-color: #555; } table { border-collapse: collapse; width: 50%; margin: auto; } th, td { border: 1px solid #ddd; padding: 8px; text-align: left; } th { background-color: #f2f2f2; }</style></head><body><h1>Temperature History</h1><nav><a href="/">Home Temperature</a> | <a href="/history">Temperature History</a> | <a href="/graph">Temperature Graph</a></nav><table><tr><th>Timestamp</th><th>Inside Temperature</th><th>Outside Temperature</th></tr>${tableRows}</table></body></html>`;
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
        }
    });
}

// Function to display temperature graph
function displayTemperatureGraph(res) {
    db.all('SELECT inside_temp, outside_temp, created_at FROM tempreading ORDER BY created_at ASC', (err, rows) => {
        if (err) {
            console.error('Error retrieving temperature data for graph:', err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('500 - Internal Server Error');
        } else if (!rows.length) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('No temperature data available');
        } else {
            // Prepare data for the graph
            const data = rows.map(row => ({
                timestamp: new Date(row.created_at).toISOString(),
                insideTemp: row.inside_temp,
                outsideTemp: row.outside_temp
            }));

            // Extract timestamps, inside and outside temperatures
            const timestamps = data.map(entry => entry.timestamp);
            const insideTemps = data.map(entry => entry.insideTemp);
            const outsideTemps = data.map(entry => entry.outsideTemp);

            // Send HTML response with a simple graph
            const html = `<html>
            <head>
                <title>Temperature Graph</title>
                <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center;}
                    nav { background-color: #3b74c4; color: #fff; padding: 10px; }
                    nav a { color: #fff; text-decoration: none; padding: 10px; }
                    nav a:hover { background-color: #555; }
                    canvas { max-width: 1200px; max-height: 800px; }
                </style>
            </head>
            <body>
                <h1>Home Temperature</h1>
                <nav>
                    <a href="/">Current Temperature</a> |
                    <a href="/history">Temperature History</a> |
                    <a href="/graph">Temperature Graph</a>
                </nav>
                <h1>Temperature Graph</h1>
                <canvas id="temperatureChart"></canvas>
                <script>
                    const ctx = document.getElementById('temperatureChart').getContext('2d');
                    new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels: ${JSON.stringify(timestamps)},
                            datasets: [
                                {
                                    label: 'Inside Temperature (°C)',
                                    data: ${JSON.stringify(insideTemps)}
                                },
                                {
                                    label: 'Outside Temperature (°C)',
                                    data: ${JSON.stringify(outsideTemps)}
                                }
                            ]
                        }
                    });
                </script>
            </body>
            </html>`;
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
        }
    });
}

