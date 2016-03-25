/// CDC NNDSS Data Map Vizualization
/// By Jaime Sanchez

// Global Variables (easier to have them here for debugging)
var mapPath = "data/us4.json";
var dataPath = 'data/nmaj-nshg.json';

// Color
var colorScheme = 'YlOrBr' // http://mbostock.github.io/d3/talk/20111018/choropleth.html

d3.select(window).on("resize",sizeChange);

var projection = d3.geo.albersUsa()
          .scale(1100)
var path = d3.geo.path()
      .projection(projection);

function init() {
  setMap();
}

function setMap() {
  // Fetch map data
  d3.json(mapPath, function (error,us) {
    if (error) {return console.error(error)};
    // Fetch health data
    d3.json(dataPath, function (error,data) {
      if (error) {return console.error(error)};
      processData(us, data)
      drawMap(us);
    });
  });
}

function drawMap(us){
  var svg = d3.select("#chartcontainer")
    .append("svg")
    .attr("width", "100%")
    .attr("class", colorScheme)
        .append("g");

  sizeChange();

  // draws lines.
  svg.selectAll(".state")
      .data(us.features)
    .enter()
      .append("path")
      .attr("d", path)
      .attr("class", "state");


  var disease = 'Babesiosis' ;
  var year = '2016';
  var week = 1;
  var method = 'previous_52_weeks_max';


  colorMap(disease,year,week,method);
  // var rr = d3.range(1,10);
  // for (var i = rr.length - 1; i >= 0; i--) {
  //   sequenceMap(disease,year,rr[i],method);
  //   console.log(rr[i]);
  // }

  // animation chorpleth http://bl.ocks.org/rgdonohue/9280446
  console.log(us);


}

function colorMap(disease,year,week,method) {
  // Give each state a color based on the filter of disease,year,week, and method.
  var dataRange = getDataRange(disease,year,week,method);
  d3.selectAll('.state')
    .attr('class',function(d) {
       var currentValue = getValueFromNest(d.properties,disease,year,week,method);
       setCurrentData(d.properties,currentValue,disease,year,week,method);
       return getColor(currentValue, dataRange) + ' '+ d3.select(this).attr("class");
    });
}

function sequenceMap(disease,year,week,method) {
  console.log("sequencing");
  var dataRange = getDataRange(disease,year,week,method);
  d3.selectAll('.state').transition() // select all states and prepare for a transition
    .duration(750) // period from transition
    .attr('class',function(d) {
       var currentValue = getValueFromNest(d.properties,disease,year,week,method);
       console.log("currentValue: "+ currentValue);
       setCurrentData(d.properties,currentValue,disease,year,week,method);
       return getColor(currentValue, dataRange) +' '+ d3.select(this).attr("class");
    });
}

function getColor (value,range) {
  if (value == -1) {
    return 'no-data';
  } else {
    var q = d3.scale.quantize()
      .domain([range[0],range[1]])
      .range(d3.range(9));
    return  "q"+q(value) + "-9";
  }
}

function getDataRange(disease,year,week,method){
  // Loops through all the data values for the given paramenter combo
  // and returns the min and the max values.
  var min = Infinity, max = -Infinity;
  d3.selectAll('.state')
    .each(function(d,i) {
      var value = Number(getValueFromNest(d.properties,disease,year,week,method));
      if (value <= min && value != -1 && value != 'undefined') {
        min = value;
      }
      if (value >= max && value != -1 && value != 'undefined') {
        max = value;
      }
    });
    return [min,max];
}



function sizeChange() {// resize example http://bl.ocks.org/jczaplew/4444770
  d3.select("g").attr("transform", "scale(" + $("#chartcontainer").width()/900 + ")");
  $("svg").height($("#chartcontainer").width()*0.618);
}

function processData(us,data){
  /// "us" is the geojson, "data" has the the values we want to plug in
  // Groupby Country data.
  var byReportingArea  = _.groupBy(data,'reporting_area');

  // Join data by country.
  for (var i in us.features){
    for (var areaName in byReportingArea){
      featureName = us.features[i].properties.NAME;
      if (featureName.toLowerCase() == areaName.toLowerCase()) {
        assignDataToFeatureProperty(us.features[i].properties,byReportingArea[areaName]);
      } else if (featureName == 'District of Columbia' &&
                 areaName == 'DIST. OF COL.'  ) {
        assignDataToFeatureProperty(us.features[i].properties,byReportingArea[areaName]);
      }
    }
  }
}

function assignDataToFeatureProperty(fProperties,data){
  /// Nests the health data and then appends it to geo data.
  /// Format:
  /// data = {"Babesiosis": // Disease
  ///         {"2016":  // Year
  ///          {"1": // Week
  ///            [ row object 1 ]
  ///            [ row object 2 ]
  ///                  ...

  // GroupBy Disease
  var byDisease = _.groupBy(data,'disease')
  // Add Groupby Year
  var byDiseaseAndYear = {}
  _.each(byDisease,function(disease,d_key){
    byDiseaseAndYear[d_key] = _.groupBy(disease,'mmwr_year')
  });
  // Add GroubBy Week
  var byDiseaseAndYearAndWeek = {}
  _.each(byDiseaseAndYear, function(disease,d_key){
    byDiseaseAndYearAndWeek[d_key] = ''
    _.each(disease, function(year,y_key){
      var somedict = {}
      somedict[y_key] =  _.groupBy(year,'mmwr_week');
      byDiseaseAndYearAndWeek[d_key] = somedict;
    });
  });

  // Append Nested data to Feature
  fProperties.nested_data = byDiseaseAndYearAndWeek;
  // Also append raw data for debug
  fProperties.rawdata = data;
}

function setCurrentData(fProperties,value,disease,year,week,method){
  var currentData = {}
  currentData.value = value;
  currentData.disease = disease;
  currentData.year = year;
  currentData.week = week;

  fProperties.currentData = currentData;
}
function getCurrentValue(fProperties){
  return fProperties.currentData.value = value;
}

function getValueFromNest(fProperties,disease,year,week,method){
  // calcs the value to display in a state for given disease,year,week and method parameters.

  // Get Value. If it doesn't exist, I will return -1.
  var value = -1;
  try {
    // just a warning, in case data changes in the future.
    if (fProperties.nested_data[disease][year][week].length > 1) {
      console.log("Warning: There is more than one row for this input combination ->"+
                  "disease: "+ disease + ", year: " + year + ", week: "+ week);}
    value = fProperties.nested_data[disease][year][week][0][method]; // taking the first week row.
  }
  catch(err) {
    console.log("DEBUG: The Value doesn't exist for this input combination -> " +
                 "disease: "+ disease + ", year: " + year + ", week: "+ week + ", method: " + method );
  }
  if (value == undefined) {
    var value = -1;
        console.log("DEBUG: The Value doesn't exist for this input combination -> " +
                 "disease: "+ disease + ", year: " + year + ", week: "+ week + ", method: " + method );
  }


  return value;
}

window.onload = init();
