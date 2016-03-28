/// CDC NNDSS Data Map Vizualization
/// By Jaime Sanchez


var MapViz = {
  // Console-accessible var
  bug : null,
  // Data Paths
  mapPath: "data/us4.json",
  dataPath: 'data/nmaj-nshg.json',

  // Data
  us: null, // US Map GeoJson
  data: null, // CDC NNDSS Data

  // Selectors
  mapSelector: "#mapViz",
  sliderSelector:"#mapSlider",

  // Color Scheme
  YlOrBr : ["#ffffe5","#fff7bc","#fee391","#fec44f","#fe9929","#ec7014","#cc4c02","#993404","#662506"],

  // Projection
  projection: null,
  path: null,

  // Current User-Defined Filters (and Defaults)
  disease:'Chlamydia trachomatis infection',
  year:'2016',
  week:1,
  method:'cum_2015',

  init: function() {

    d3.select(window).on("resize",MapViz.sizeChange);
    MapViz.setMap();

  },

  setMap: function() {

    // Fetch map data
    d3.json(MapViz.mapPath, function (error,us) {
      if (error) {return console.error(error)};
      // Fetch health data
      d3.json(MapViz.dataPath, function (error,data) {
        if (error) {return console.error(error)};
        MapViz.us = us;
        MapViz.data = data;
        MapViz.processData()
        MapViz.drawMap();
      });
    });
  },

  drawMap: function(){
    // Projection
    this.projection =  d3.geo.albersUsa().scale(1100);
    this.path =  d3.geo.path().projection(this.projection);

    var svg = d3.select(this.mapSelector)
      .append("svg")
      .attr("width", "100%")
          .append("g");

    MapViz.sizeChange();

    svg.selectAll(".state") // Select state objects (which don't exist yet)
        .data(this.us.features) // bind data to the non-existent objexts
      .enter() .append("path") // prepare data to be appended to paths
        .attr("class", "state") // give it a class for styling and access later
        .attr("d", this.path); //Create them using the svg path generator defined above

    MapViz.colorMap(this.disease,this.year,this.week,this.method);

    // var rr = d3.range(1,10);
    // for (var i = rr.length - 1; i >= 0; i--) {
    //   MapViz.sequenceMap('Chlamydia trachomatis infection','2016',rr[i],'cum_2015');
    // }

    // animation chorpleth http://bl.ocks.org/rgdonohue/9280446
    console.log(this.us);

    MapViz.drawSlider()

  },

  drawSlider: function() {
    d3.select(MapViz.sliderSelector).remove();
    d3.select("#sliderContainer").append("div").attr("id", MapViz.sliderSelector.replace("#",""));

    var range = MapViz.getWeekRange(MapViz.disease,MapViz.year);
    console.log("week range: " + range);
    d3.select(MapViz.sliderSelector).call(
      d3.slider().axis(true).min(range[0]).max(range[1]).step(1)
        .on("slide" , function(evt,value) {
          MapViz.sequenceMap('Chlamydia trachomatis infection','2016',value,'cum_2015')
      }));
  },

  colorMap: function(disease,year,week,method) {
    // Give each state a color based on the filter of disease,year,week, and method.
    var dataRange = MapViz.getDataRange(disease,year,week,method);
    d3.selectAll('.state')
      .style('fill', function(d){
         var currentValue = MapViz.getValueFromNest(d.properties,disease,year,week,method);
         MapViz.setCurrentData(d.properties,currentValue,disease,year,week,method);
         var le_color = MapViz.getColor(currentValue, dataRange);
         return le_color;
      });
  },

  sequenceMap: function(disease,year,week,method) {
    var dataRange = MapViz.getDataRange(disease,year,week,method);
    d3.selectAll('.state').transition() // select all states and prepare for a transition
      .duration(7) // period from transition
      .style('fill', function(d){
         var currentValue = MapViz.getValueFromNest(d.properties,disease,year,week,method);
         MapViz.setCurrentData(d.properties,currentValue,disease,year,week,method);
         var le_color = MapViz.getColor(currentValue, dataRange);
         return le_color;
      });
  },

  getColor: function (value,range) {
    if (value == -1 | value == undefined) {
      return '#CCC7C8'; // no data.
    } else {
      var q = d3.scale.quantize()
        .domain([range[0],range[1]])
        .range(MapViz.YlOrBr);
      return  q(value);
    }
  },


  getDataRange: function(disease,year,week,method){
    // Loops through all the data values for the given paramenter combo
    // and returns the min and the max values.
    var min = Infinity, max = -Infinity;
    var weekMax = 1;
    d3.selectAll('.state')
      .each(function(d,i) {
        var value = Number(MapViz.getValueFromNest(d.properties,disease,year,week,method));
        if (value <= min && value != -1 && value != 'undefined') {
          min = value;
        }
        if (value >= max && value != -1 && value != 'undefined') {
          max = value;
        }

      });

      return [min,max];
  },
  getWeekRange: function(disease,year){
    // Loops through all the data values for the given paramenter combo
    // and returns the min and the max values.
    var minWeek = 1, maxWeek = 2;
    d3.selectAll('.state')
      .each(function(d,i) {
        var localWeekMax = MapViz.getMaxWeekFromNest(d.properties,disease,year);
        if (localWeekMax > maxWeek) {
          maxWeek = localWeekMax;
        }
      });
    return [minWeek,maxWeek];
  },

  sizeChange: function() {// resize example http://bl.ocks.org/jczaplew/4444770
    console.log("Resizing");
    console.log("Selector: " + MapViz.mapSelector);
    d3.select("#mapViz g").attr("transform", "scale(" + $("#mapViz").width()/900 + ")");
    $("svg").height($("#mapViz").width()*0.618);
    MapViz.drawSlider();
  },

  processData: function(){
    /// "us" is the geojson, "data" has the the values we want to plug in
    // Groupby Country data.
    var byReportingArea  = _.groupBy(MapViz.data,'reporting_area');

    console.log(MapViz.us);
    // Join data by country.
    for (var i in MapViz.us.features){
      for (var areaName in byReportingArea){
        featureName = MapViz.us.features[i].properties.NAME;
        if (featureName.toLowerCase() == areaName.toLowerCase()) {
          MapViz.assignDataToFeatureProperty(MapViz.us.features[i].properties,byReportingArea[areaName]);
        } else if (featureName == 'District of Columbia' &&
                   areaName == 'DIST. OF COL.'  ) {
          MapViz.assignDataToFeatureProperty(MapViz.us.features[i].properties,byReportingArea[areaName]);
        }
      }
    }
  },

  assignDataToFeatureProperty: function(fProperties,data){
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
  },

  setCurrentData: function(fProperties,value,disease,year,week,method){
    var currentData = {}
    currentData.value = value;
    currentData.disease = disease;
    currentData.year = year;
    currentData.week = week;

    fProperties.currentData = currentData;
  },

  getCurrentValue: function(fProperties){
    return fProperties.currentData.value;
  },

  getValueFromNest: function(fProperties,disease,year,week,method){
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
  },

  getMaxWeekFromNest: function(fProperties,disease,year){
    try {
      var year = fProperties.nested_data[disease][year];
      var weeks = _.keys(year);
      var maxWeek = Number(weeks.pop())
      console.log(maxWeek);
      return maxWeek;
    } catch(err){
         console.log("DEBUG: Weeks don't exist for this input combination -> " +
                   "disease: "+ disease + ", year: " + year + ". Error: " + err);
         return 1;
    }
  }
}



window.onload = MapViz.init();

