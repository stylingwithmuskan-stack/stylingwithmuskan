const http = require('http');

http.get('http://localhost:3001/api/content/categories?limit=100', (res2) => {
    let data2 = '';
    res2.on('data', (chunk) => { data2 += chunk; });
    res2.on('end', () => {
        const catResp = JSON.parse(data2);
        const categories = catResp.data || [];
        
        // Find categories belonging to Hair Studio
        const hairStudioCats = categories.filter(c => String(c.serviceType) === "1775214977462");
        const hairCatIds = hairStudioCats.map(c => String(c.id || c._id));
        
        http.get('http://localhost:3001/api/content/services?limit=1000', (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                const response = JSON.parse(data);
                const services = response.data || [];
                const activeServices = services.filter(s => s.isActive);
                
                const hairServices = activeServices.filter(s => {
                    const catId = String(typeof s.category === 'object' ? s.category._id : s.category);
                    // Also include services that are orphaned but whose name contains hair just in case
                    return hairCatIds.includes(catId) || (!s.category && s.name.toLowerCase().includes('hair'));
                });
                
                console.log(`\nTotal Active Hair Studio services found: ${hairServices.length}`);
                
                console.log('\n--- Missing / Problematic Services ---');
                let foundIssue = false;
                hairServices.forEach(s => {
                    let issue = '';
                    if (!s.category || String(s.category).trim() === '') issue += '[NO CATEGORY / ORPHANED] ';
                    if (s.zones && s.zones.length > 0) issue += `[ZONES RESTRICTED: ${s.zones.join(', ')}] `;
                    
                    if (issue !== '') {
                        console.log(`- ${s.name} (₹${s.price}) -> Issue: ${issue}`);
                        foundIssue = true;
                    }
                });
                
                if (!foundIssue) {
                    console.log("No obvious issues found.");
                }
            });
        });
    });
});
