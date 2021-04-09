var map = L.map('map').setView([38.5828, -90.6629], 9);
L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
   attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

map.options.minZoom = 9;
map.options.maxZoom = 15;

let clicked = false;
let clickedLayer = null;

function numberWithCommas(x) {
   return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

d3.csv('data/District_Properties.csv').then(function(properties) {
   const propertyScales = new Map([
      ['perc_frl', [[0,100], ['#ffffe6', '#ffd4b2', '#ffa77e', '#ff7248', '#ff0000']]],
      ['perc_college', [[0,100], ['#ffffe6', '#ffd4b2', '#ffa77e', '#ff7248', '#ff0000']]],
      ['spending_per_stud', [[null, null], ['#ffffe6', '#ffd4b2', '#ffa77e', '#ff7248', '#ff0000']]]
   ]);

   const demographicToId = new Map([
      ['White', 'perc_white'],
      ['Mixed Race', 'perc_multi'],
      ['Hispanic', 'perc_hisp'],
      ['Pacific Islander', 'perc_pi'],
      ['Black', 'perc_black'],
      ['Asian', 'perc_asian'],
      ['Native American', 'perc_na']
   ]);

   getColorScale = function(property) {
      domain = propertyScales.get(property)[0];
      range = propertyScales.get(property)[1];
      if(domain[0]==null) {
         domain[0] = d3.min(properties, function(d){
            return parseInt(d[property]);
         });
      }
      if(domain[1]==null) {
         domain[1] = d3.max(properties, function(d){
            return parseInt(d[property]);
         });
      }
      return d3.scaleQuantile()
               .domain(domain)
               .range(range);
   }
   colorScale = getColorScale('perc_frl');

   setLegend = function(property) {
      range = propertyScales.get(property)[1];
      legend = d3.select('#legend')
      range.forEach(function(color) {
         legendItem = legend.append('p').classed("active-legend", true);
         legendItem.append('svg')
            .attr("height", 20)
            .attr("width", 20)
            .append("rect")
               .attr("x", 0)
               .attr("y", 0)
               .attr("height", 20)
               .attr("width", 20)
               .style("fill", color);
         legendItem.append("span")
            .html(`<span style="padding-left: 10px;">${getColorScale(property).invertExtent(color)[0]} – ${getColorScale(property).invertExtent(color)[1]}</span>`)
      });
   }

   let feature_num = 1;

   const district_properties = new Map(properties.map( d => [d.DISTRICT_N, d] ));

   $.getJSON('data/School_Districts.json', function(geoData) {
      L.geoJson(geoData, {
         onEachFeature: function(feature, layer) {   
            data = district_properties.get(feature.properties.DISTRICT_N);

            let popup = $(`
               <div style="font-family: "Avenir Next";" class="container">
                  <div class="row justify-content-center">
                     <h5>District</h5>
                  </div>
                  <div class="row justify-content-center">
                     <span id="accred_status_display"></span>
                  </div>
                  <div class="row">
                     <div>
                        <svg id="lollipop-chart-${feature_num}" width="270" height="210"></svg>
                     </div>
                     <div class="col-12 stats"><strong>Total students:</strong> <span id="num_students_display"></span></div>
                  </div>
                  <div class="row">
                     <div class="col-12"><strong>Students on Free Reduced Lunch:</strong> <span id="perc_frl_display"></span>%</div>
                     <div class="col-12"><strong>Students College-bound:</strong> <span id="perc_college_display"></span>%</div>
                     <div class="col-12"><strong>Average Expenditures Per Student:</strong> $<span id="spending_per_stud_display"></span></div>
                  </div>
               </div>
            `);

            $(popup).find('#accred_status_display').text(data.accred_status);
            if(data.accred_status=="Accredited") {
               $(popup).find('#accred_status_display').css("color", "green");
            }
            else {
               $(popup).find('#accred_status_display').css("color", "#f2a846");
            }

            let chart = d3.select(popup.get(0)).select(`#lollipop-chart-${feature_num}`);

            let xScale = d3.scaleLinear()
               .domain([0, 100])
               .range([0, 150]);
            chart.append("g")
               .attr("transform", "translate(90, 160)")
               .call(d3.axisBottom(xScale))
               .selectAll("text")
                 .attr("transform", "translate(-10,0)rotate(-45)")
                 .style("text-anchor", "end");

            chart.append("text")
               .text("% student body")
               .style("text-anchor", "middle")
               .style("fill", "black")
               .style("font-size", 10)
               .attr("x", 165)
               .attr("y", 195);

            let yScaleDomain = ["White", "Mixed Race", "Hispanic", "Pacific Islander", "Black", "Asian", "Native American"]
            yScaleDomain = yScaleDomain.filter(dem => data[demographicToId.get(dem)]!='');
            var yScale = d3.scaleBand()
               .range([0, 150])
               .domain(yScaleDomain)
               .padding(1);
            chart.append("g")
               .attr("transform", "translate(90, 10)")
               .call(d3.axisLeft(yScale));

            chart.selectAll(`.chart-lines-${feature_num}`)
               .data(yScaleDomain)
               .enter()
               .append("line")
                  .attr("x1", function(d) { return xScale(data[demographicToId.get(d)])+90; })
                  .attr("x2", xScale(0)+90)
                  .attr("y1", function(d) { return yScale(d)+10.5; })
                  .attr("y2", function(d) { return yScale(d)+10.5; })
                  .attr("stroke", "grey");

            chart.selectAll(`.chart-circles-${feature_num}`)
               .data(yScaleDomain)
               .enter()
               .append("circle")
                  .attr("cx", function(d) { return xScale(data[demographicToId.get(d)])+90; })
                  .attr("cy", function(d) { return yScale(d)+10.5; })
                  .attr("r", 5)
                  .style("fill", "#69b3a2")
                  .attr("stroke", "black");

            chart.selectAll(`.chart-data-${feature_num}`)
               .data(yScaleDomain)
               .enter()
               .append("text")
                  .text(function(d) {
                     return data[demographicToId.get(d)];
                  })
                  .style("text-anchor", "start")
                  .style("font-size", 8)
                  .attr("x", function(d) { return xScale(data[demographicToId.get(d)])+100; })
                  .attr("y", function(d) { return yScale(d)+13.5; });               



            $(popup).find('#num_students_display').text(numberWithCommas(data.num_students));

            $(popup).find('h5').text(data.DISTRICT_N);
            $(popup).find('#perc_frl_display').text(data.perc_frl);
            $(popup).find('#perc_college_display').text(data.perc_college);
            $(popup).find('#spending_per_stud_display').text(numberWithCommas(data.spending_per_stud));
 
            feature_num++;

            layer.bindPopup(popup.html());
            layer.off("click");

            layer.on('mouseover', function() {
               // layer.setStyle({fillOpacity: 0.95});
               layer.setStyle({weight: 7});
            });
            layer.on('mouseout', function() {
               if(layer!=clickedLayer) {
                  // layer.setStyle({fillOpacity: 0.7});
                  layer.setStyle({weight: 3});
               }
            });

            layer.on('click', function() {
               if(layer == clickedLayer) {
                  // layer.setStyle({fillOpacity: 0.7});
                  layer.setStyle({weight: 3});
                  clicked = false;
                  clickedLayer = null;
                  layer.closePopup();
               }
               else if (clicked) {
                  // clickedLayer.setStyle({fillOpacity: 0.7});
                  clickedLayer.setStyle({weight: 3});
                  // layer.setStyle({fillOpacity: 0.95});
                  layer.setStyle({weight: 7});
                  layer.openPopup();
                  clickedLayer.closePopup();               
                  clickedLayer = layer;
               }
               else {
                  // layer.setStyle({fillOpacity: 0.95});
                  layer.setStyle({weight: 7});
                  clickedLayer = layer;
                  clicked = true;
                  layer.openPopup();
               }
            });
         },
         style: function(feature) {
            data = district_properties.get(feature.properties.DISTRICT_N);
            return {
               color: '#520119',
               fillColor: colorScale(data.perc_frl), 
               weight: 3,
               fillOpacity: 0.7
            };
         }
      }).addTo(map);

      setLegend('perc_frl');

      d3.selectAll('.leaflet-interactive').data(properties);

      $('.form-check').click(function() { 
         indicator = $('.form-check input:radio:checked').attr('id');
         colorScale = getColorScale(indicator);
         d3.selectAll('.leaflet-interactive')
            .style("fill", function(d) {
               return colorScale(d[indicator]);
            });
         d3.selectAll('.active-legend').remove();
         setLegend(indicator);
      });
      
   });
});