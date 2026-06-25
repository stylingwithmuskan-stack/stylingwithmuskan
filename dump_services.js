const http = require('http');
const fs = require('fs');

http.get('http://localhost:3001/api/content/services?limit=1000', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      const services = response.data || response || [];
      fs.writeFileSync('all_services_dump.json', JSON.stringify(services, null, 2));
      console.log('Dumped to all_services_dump.json');
    } catch (e) {
      console.error('Error parsing JSON', e);
    }
  });
}).on('error', (err) => {
  console.log('Error: ' + err.message);
});
