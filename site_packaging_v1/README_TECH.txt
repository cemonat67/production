ZERO@ECOSYSTEM — Demo Package v1.0 (Technical) 
 
 Structure: 
 - index.html: launcher + router (?module ?role ?facility ?demo) 
 - GarmentDPP.html: production cockpit (Orders + Trends) 
 - data/orders.json: order seed 
 - data/kpi_trends.json: KPI time series seed 
 - No-CDN policy: all assets local 
 
 Local Run: 
 cd site_packaging_v1 
 python3 -m http.server 8083 --bind 0.0.0.0 
 
 iPad: 
 http://<IMAC_IP>:8083/