const http = require('http');

http.get('http://localhost:3001/api/content/services?limit=1000', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      const services = response.data || response;
      
      const keratin = services.find(s => s.name.toLowerCase().includes('keratin hair spa'));
      console.log('Keratin Hair Spa:', JSON.stringify(keratin, null, 2));

      // Also let's find one of the services that IS showing
      const lorealMask = services.find(s => s.name.toLowerCase().includes('loreal hair spa repair mask'));
      console.log('Loreal Mask:', JSON.stringify(lorealMask, null, 2));
      
      if (keratin && lorealMask) {
          console.log('\n--- COMPARISON ---');
          console.log('Keratin Category ID:', keratin.category);
          console.log('Loreal Mask Category ID:', lorealMask.category);
          console.log('Keratin Gender:', keratin.gender);
          console.log('Loreal Gender:', lorealMask.gender);
          console.log('Keratin Zones:', keratin.zones);
          console.log('Loreal Zones:', lorealMask.zones);
      }
    } catch (e) {
      console.error('Error parsing JSON:', e);
    }
  });
}).on('error', (err) => {
  console.log('Error: ' + err.message);
});
