import fetch from 'node-fetch';

async function test() {
    try {
        const res = await fetch('http://localhost:5000/api/content/services?limit=100');
        const data = await res.json();
        const service = data.services.find(s => s.name === 'Keratin Hair Spa');
        console.log(JSON.stringify(service, null, 2));
    } catch (e) {
        console.error(e);
    }
}
test();
