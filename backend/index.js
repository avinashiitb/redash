// Redash Backend Module for DevScribe Dynamic Execution

async function testConnection(config) {
    if (!config || !config.host) {
        return { success: false, message: "No connection configuration selected" };
    }
    try {
        const response = await fetch(`${config.host}/api/session`, {
            method: 'GET',
            headers: { 'Authorization': `Key ${config.password}` }
        });
        if (response.ok) {
            return { success: true, message: "Connected successfully" };
        } else {
            return { success: false, message: `HTTP Error: ${response.status}` };
        }
    } catch (e) {
        return { success: false, message: e.message };
    }
}

async function getDatabases(config) {
    if (!config || !config.host) {
        return (config && config.database) ? [config.database] : [];
    }
    try {
        const response = await fetch(`${config.host}/api/data_sources`, {
            headers: { 'Authorization': `Key ${config.password}` }
        });
        if (!response.ok) return config.database ? [config.database] : [];
        const sources = await response.json();
        return (Array.isArray(sources) ? sources : []).map(s => `${s.name}||${s.id}||${s.type || s.syntax || ''}`);
    } catch (e) {
        return config.database ? [config.database] : [];
    }
}

async function getTables(config, database) {
    if (!config || !config.host) {
        return [];
    }
    const activeDb = database || config.database;
    let dataSourceId = activeDb;
    if (dataSourceId && typeof dataSourceId === 'string') {
        if (dataSourceId.includes('||')) {
            const parts = dataSourceId.split('||');
            if (parts.length >= 2) {
                dataSourceId = parts[1];
            } else {
                dataSourceId = parts[0];
            }
        } else {
            const match = dataSourceId.match(/^(\d+):/);
            if (match) {
                dataSourceId = match[1];
            }
        }
    }
    
    if (dataSourceId && isNaN(Number(dataSourceId))) {
        try {
            const dsRes = await fetch(`${config.host}/api/data_sources`, {
                headers: { 'Authorization': `Key ${config.password}` }
            });
            if (dsRes.ok) {
                const sources = await dsRes.json();
                const found = (Array.isArray(sources) ? sources : []).find(
                    s => s.name === dataSourceId || String(s.id) === dataSourceId
                );
                if (found) {
                    dataSourceId = String(found.id);
                }
            }
        } catch (e) {
            console.error("Failed to resolve Redash data source name in db-get-tables:", e.message);
        }
    }

    if (!dataSourceId) {
        return [];
    }
    const response = await fetch(`${config.host}/api/data_sources/${dataSourceId}/schema`, {
        method: 'GET',
        headers: { 'Authorization': `Key ${config.password}` }
    });
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const data = await response.json();
    
    let schema = [];
    if (data) {
        if (Array.isArray(data)) {
            schema = data;
        } else if (data.schema) {
            if (Array.isArray(data.schema)) {
                schema = data.schema;
            } else if (Array.isArray(data.schema.tables)) {
                schema = data.schema.tables;
            }
        }
    }
    
    return schema.map(t => ({
        name: t.name,
        type: 'table',
        columns: (t.columns || []).map(c => ({
            name: typeof c === 'string' ? c : c.name,
            type: typeof c === 'string' ? 'string' : (c.type || 'string'),
            isPrimary: false
        }))
    }));
}

async function executeQuery(config, query, database) {
    if (!config || !config.host) {
        throw new Error("Please select a valid connection first");
    }
    const activeDb = database || config.database;
    const startTime = performance.now();
    
    let dataSourceId = activeDb;
    if (dataSourceId && typeof dataSourceId === 'string') {
        if (dataSourceId.includes('||')) {
            const parts = dataSourceId.split('||');
            if (parts.length >= 2) {
                dataSourceId = parts[1];
            } else {
                dataSourceId = parts[0];
            }
        } else {
            const match = dataSourceId.match(/^(\d+):/);
            if (match) {
                dataSourceId = match[1];
            }
        }
    }
    
    if (dataSourceId && isNaN(Number(dataSourceId))) {
        try {
            const dsRes = await fetch(`${config.host}/api/data_sources`, {
                headers: { 'Authorization': `Key ${config.password}` }
            });
            if (dsRes.ok) {
                const sources = await dsRes.json();
                const found = (Array.isArray(sources) ? sources : []).find(
                    s => s.name === dataSourceId || String(s.id) === dataSourceId
                );
                if (found) {
                    dataSourceId = String(found.id);
                }
            }
        } catch (e) {
            console.error("Failed to resolve Redash data source name in db-execute-query:", e.message);
        }
    }

    if (!dataSourceId) {
        throw new Error("No Redash data source specified");
    }
    
    const response = await fetch(`${config.host}/api/query_results`, {
        method: 'POST',
        headers: {
            'Authorization': `Key ${config.password}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            data_source_id: Number(dataSourceId),
            query: query,
            max_age: 0
        })
    });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Failed to start query execution: ${response.status} ${errText}`);
    }
    const data = await response.json();
    const job = data.job;
    if (!job) throw new Error("No job returned from Redash");
    let jobId = job.id;
    let jobStatus = job.status;
    let queryResultId = null;

    while (jobStatus < 3) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const jobResponse = await fetch(`${config.host}/api/jobs/${jobId}`, {
            headers: { 'Authorization': `Key ${config.password}` }
        });
        if (!jobResponse.ok) throw new Error(`Failed to check job status: ${jobResponse.status}`);
        const jobData = await jobResponse.json();
        jobStatus = jobData.job.status;
        if (jobStatus === 3) {
            queryResultId = jobData.job.query_result_id;
        } else if (jobStatus === 4) {
            throw new Error(jobData.job.error || "Query execution failed in Redash");
        }
    }

    const resultResponse = await fetch(`${config.host}/api/query_results/${queryResultId}`, {
        headers: { 'Authorization': `Key ${config.password}` }
    });
    if (!resultResponse.ok) throw new Error(`Failed to fetch query results: ${resultResponse.status}`);
    const resultData = await resultResponse.json();
    
    const queryResult = resultData.query_result;
    let rows = [];
    let fields = [];
    if (queryResult && queryResult.data) {
        rows = queryResult.data.rows || [];
        fields = (queryResult.data.columns || []).map(c => c.name);
    }
    
    const executionTime = Math.round(performance.now() - startTime);
    const dataStr = JSON.stringify(rows);
    const sizeKB = (Buffer.byteLength(dataStr, 'utf8') / 1024).toFixed(1) + " KB";

    const columns = fields.map(f => ({ key: f, label: f, type: 'string' }));

    return {
        success: true,
        executionTime,
        size: sizeKB,
        columns,
        data: rows
    };
}

module.exports = {
    testConnection,
    getDatabases,
    getTables,
    executeQuery
};
