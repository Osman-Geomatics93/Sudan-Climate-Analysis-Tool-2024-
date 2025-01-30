// Import and filter country boundaries for Sudan
var dataset = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017');
var SudanBorder = dataset.filter(ee.Filter.eq('country_na', 'Sudan'));

// Import datasets
var modis = ee.ImageCollection("MODIS/061/MOD11A2");
var chirps = ee.ImageCollection("UCSB-CHG/CHIRPS/PENTAD");

// Define study period (2024)
var start = ee.Date('2024-01-01');
var end = ee.Date('2024-12-31');
var dateRange = ee.DateRange(start, end);

// Process LST data
var modLSTday = modis
  .filterDate(dateRange)
  .filterBounds(SudanBorder)
  .select('LST_Day_1km')
  .map(function(img) {
    return img
      .multiply(0.02)
      .subtract(273.15)
      .clip(SudanBorder)
      .copyProperties(img, ['system:time_start']);
  });

// Process rainfall data
var rainfall = chirps
  .filterDate(dateRange)
  .filterBounds(SudanBorder)
  .map(function(img) {
    return img
      .clip(SudanBorder)
      .copyProperties(img, ['system:time_start']);
  });

// Create temperature chart
var tempChart = ui.Chart.image.series({
  imageCollection: modLSTday,
  region: SudanBorder,
  reducer: ee.Reducer.mean(),
  scale: 1000
}).setOptions({
  title: 'Land Surface Temperature - Sudan (2024)',
  vAxis: {title: 'Temperature (°C)'},
  hAxis: {title: 'Date', format: 'MM-yy'},
  lineWidth: 2,
  pointSize: 4,
  series: {
    0: {color: '#FF5252'}
  }
});

// Create rainfall chart
var rainfallChart = ui.Chart.image.series({
  imageCollection: rainfall,
  region: SudanBorder,
  reducer: ee.Reducer.sum(),
  scale: 5000
}).setOptions({
  title: 'Rainfall - Sudan (2024)',
  vAxis: {title: 'Rainfall (mm)'},
  hAxis: {title: 'Date', format: 'MM-yy'},
  lineWidth: 2,
  pointSize: 4,
  series: {
    0: {color: '#2196F3'}
  }
});

// Visualization parameters
var tempVis = {
  min: 25,
  max: 45,
  palette: ['#313695', '#4575B4', '#74ADD1', '#ABD9E9', '#E0F3F8', 
            '#FFFFBF', '#FEE090', '#FDAE61', '#F46D43', '#D73027']
};

var rainfallVis = {
  min: 0,
  max: 50,
  palette: ['#FFFFFF', '#D4E8F1', '#2196F3', '#1565C0', '#0D47A1']
};

// Create legend
var createLegend = function() {
  var legend = ui.Panel({
    style: {
      position: 'bottom-right',
      padding: '8px 15px',
      backgroundColor: 'white'
    }
  });

  var makeRow = function(color, name, value) {
    var colorBox = ui.Label({
      style: {
        backgroundColor: color,
        padding: '8px',
        margin: '0 5px 4px 0',
        border: '1px solid #999'
      }
    });

    var description = ui.Label({
      value: name + (value ? ': ' + value : ''),
      style: {margin: '0 0 4px 0'}
    });

    return ui.Panel({
      widgets: [colorBox, description],
      layout: ui.Panel.Layout.Flow('horizontal')
    });
  };

  legend.add(ui.Label('Climate Indicators 2024', {
    fontWeight: 'bold',
    fontSize: '16px',
    margin: '0 0 10px 0'
  }));

  // Temperature Legend
  legend.add(ui.Label('Temperature (°C)', {fontWeight: 'bold', margin: '10px 0 3px 0'}));
  legend.add(makeRow('#D73027', 'High', '> 40°C'));
  legend.add(makeRow('#FDAE61', 'Medium', '30-40°C'));
  legend.add(makeRow('#313695', 'Low', '< 30°C'));

  // Rainfall Legend
  legend.add(ui.Label('Rainfall (mm)', {fontWeight: 'bold', margin: '10px 0 3px 0'}));
  legend.add(makeRow('#0D47A1', 'High', '> 30mm'));
  legend.add(makeRow('#2196F3', 'Medium', '10-30mm'));
  legend.add(makeRow('#D4E8F1', 'Low', '< 10mm'));

  return legend;
};

// Initialize map
Map.centerObject(SudanBorder, 6);
Map.setOptions('HYBRID');

// Add layers
Map.addLayer(SudanBorder, {color: 'red'}, 'Sudan Border');
Map.addLayer(modLSTday.mean(), tempVis, 'Temperature');
Map.addLayer(rainfall.mean(), rainfallVis, 'Rainfall', false);

// Add legend
Map.add(createLegend());

// Print charts
print('Temperature Time Series', tempChart);
print('Rainfall Time Series', rainfallChart);

// Add layer selector
var layerSelector = ui.Select({
  items: ['Temperature', 'Rainfall'],
  value: 'Temperature',
  onChange: function(selected) {
    Map.layers().forEach(function(layer) {
      layer.setShown(layer.getName() === selected || layer.getName() === 'Sudan Border');
    });
  },
  style: {
    position: 'top-left',
    padding: '8px'
  }
});

Map.add(layerSelector);

// Add click analysis functionality
Map.onClick(function(coords) {
  var point = ee.Geometry.Point(coords.lon, coords.lat);
  
  var tempValue = modLSTday.mean().reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: point,
    scale: 1000
  });
  
  var rainValue = rainfall.mean().reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: point,
    scale: 5000
  });
  
  print('Location Analysis:',
        'Temperature:', tempValue.get('LST_Day_1km').getInfo().toFixed(2) + '°C',
        'Rainfall:', rainValue.get('precipitation').getInfo().toFixed(2) + ' mm');
});

// Export data
Export.image.toDrive({
  image: modLSTday.mean(),
  description: 'Sudan_Temperature_2024',
  scale: 1000,
  region: SudanBorder,
  maxPixels: 1e9
});

Export.image.toDrive({
  image: rainfall.mean(),
  description: 'Sudan_Rainfall_2024',
  scale: 5000,
  region: SudanBorder,
  maxPixels: 1e9
});