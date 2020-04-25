let numberFormat = d3.format(".2~s");
let linkParams = {
  name: '',
  depth: 0
};
var stratify = d3.stratify()
.parentId(function (d) { return d.id.substring(0, d.id.lastIndexOf(".")); });

var tree = d3.tree()
.size([2 * Math.PI, 500])
.separation(function (a, b) { return (a.parent == b.parent ? 1 : 2) / a.depth; });

var svg = d3.select("svg"),
width = +svg.attr("width"),
height = +svg.attr("height"),
g = svg.append("g").attr("transform", translate((width / 2 + 40), (height / 2 + 90)));

let modifyRow = d => ({
  callTypeGroup: d.callTypeGroup,
  callType: d.callType,
  unitType: d.unitType,
  count: +d.count,
  parent: d.callType,
  name: d.unitType
});

let drawRadial = d3.linkRadial()
.angle(d => {
  return d.theta + Math.PI / 2;
}) // rotate, 0 angle is mapped differently here
.radius(d => d.radial);

let curvedLine = function (node) {
  return drawRadial(node);
};

linkParams.name = 'All Incidents';

d3.csv("fdcsf.csv", modifyRow).then(data => {
  data = data.filter(d => d.callTypeGroup === 'Alarm' || d.callTypeGroup === 'Potentially Life-Threatening' || d.callTypeGroup === 'Non Life-threatening' || d.callTypeGroup === 'Fire');
  let depth1 = data.map(d => ({
    name: d.callTypeGroup,
    parent: 'All Incidents',
    count: 0
  }));
  
  let depth2 = data.map(d => ({
    name: d.callType,
    parent: d.callTypeGroup,
    count: 0
  }));
  
  depth1 = removeDuplicates(depth1, item => item.name);
  depth2 = removeDuplicates(depth2, item => item.name);
  depth0 = { name: 'All Incidents', parent: '' };
  let tree = [...data, ...depth2, ...depth1, depth0];
  
  // Make the hierarchy
  stratified = d3.stratify()
  .id(d => d.name)
  .parentId(d => d.parent)
  (tree);
  
  let color = d3.scaleSequential(d3.interpolatePlasma)
  .domain([stratified.height, 0]);
  
  stratified.sort(function (a, b) {
    return b.height - a.height || b.data.sum - a.data.sum;
  });
  // Calculate some values (total counts)
  stratified.sum(d => d.count);
  stratified.each(function (node) {
    node.data.sum = node.value;
  });
  
  drawNodeLinkVis(stratified);
  function drawLinks(g, links, generator) {
    let paths = g.selectAll('path')
    .data(links)
    .enter()
    .append('path')
    .attr('d', generator)
    .attr('class', 'link');
  }
  
  function drawNodes(g, nodes, raise) {
    var r = 5;
    let circles = g.selectAll('circle')
    .data(nodes, node => node.data.name)
    .enter()
    .append('circle')
    .attr('r', d => d.r ? d.r : r)
    .attr('cx', d => d.x)
    .attr('cy', d => d.y)
    .attr('id', d => d.data.name)
    .attr('class', 'node')
    .style('fill', d => color(d.depth));
    
    setupEvents(g, circles, raise);
  }
  
  function drawNodeLinkVis(stratified) {
    // Find the selected node to draw
    let selectedRoot = null;
    stratified.each(function (node) {
      if (node.data.name == linkParams.name) {
        selectedRoot = node;
      }
    });
    //  Actually draw node link
    let module = selectedRoot.copy();
    let pad = 0;
    let diam = 550;
    // let layout = d3.tree().size([2*Math.PI, (diam/2) - pad]);
    let layout = d3.cluster().size([2 * Math.PI, (diam / 2) - pad]);
    
    layout(module);
    
    module.each(node => {
      node.theta = node.x;
      node.radial = node.y;
      var point = toCartesian(node.radial, node.theta);
      node.x = point.x;
      node.y = point.y;
    });
    
    let width = 600;
    let height = 600;
    svg.selectAll('g').remove();
    let plot = svg.append('g')
    .attr('id', 'plot1')
    .attr('transform', translate(width / 2, height / 2));
    drawLinks(plot.append('g').attr('id', 'links'), module.links(), curvedLine);
    drawNodes(plot.append('g').attr('id', 'nodes'), module.descendants(), true);
  }
  
  
});

function removeDuplicates(data, f) {
  let visited = [];
  let filtered = data.filter(item => {
    let result = f(item);
    if (!visited.includes(result)) {
      visited.push(result);
      return true;
    } else {
      return false;
    }
  });
  return filtered;
}


function toCartesian(r, theta) {
  return {
    x: r * Math.cos(theta),
    y: r * Math.sin(theta)
  };
}

function translate(x, y) {
  return `translate(${x},${y})`;
}


function setupEvents(g, selection, raise) {
  selection.on('mouseover.highlight', function (d) {
    // https://github.com/d3/d3-hierarchy#node_path
    // returns path from d3.select(this) node to selection.data()[0] root node
    let path = d3.select(this).datum().path(selection.data()[0]);
    
    
    // select all of the nodes on the shortest path
    let update = selection.data(path, node => node.data.name);
    // highlight the selected nodes
    d3.select(this).classed('selected', true);
    
    if (raise) {
      d3.select(this).raise();
    }
  });
  
  selection.on('mouseout.highlight', function (d) {
    let path = d3.select(this).datum().path(selection.data()[0]);
    let update = selection.data(path, node => node.data.name);
    d3.select(this).classed('selected', false);
  });
  
  // show tooltip text on mouseover (hover)
  selection.on('mouseover.tooltip', function (d) {
    showTooltip(g, d3.select(this));
  });
  
  // remove tooltip text on mouseout
  selection.on('mouseout.tooltip', function (d) {
    g.select("#tooltip").remove();
  });
}

function showTooltip(g, node) {
  let gbox = g.node().getBBox();     // get bounding box of group BEFORE adding text
  let nbox = node.node().getBBox();  // get bounding box of node
  
  // calculate shift amount
  let dx = nbox.width / 2;
  let dy = nbox.height / 2;
  
  // retrieve node attributes (calculate middle point)
  let x = nbox.x + dx;
  let y = nbox.y + dy;
  let datum = node.datum();
  let name = datum.data.name;
  // use node name and total size as tooltip text
  let text = `${name} (${numberFormat(datum.data.sum)})`;
  // create tooltip
  let tooltip = g.append('text')
  .text(text)
  .attr('x', x)
  .attr('y', y)
  .attr('dy', -dy - 4) // shift upward above circle
  .attr('text-anchor', 'middle') // anchor in the middle
  .attr('id', 'tooltip');
  let tbox = tooltip.node().getBBox();
  if (tbox.x < gbox.x) {
    tooltip.attr('text-anchor', 'start');
    tooltip.attr('dx', -dx); // nudge text over from center
  }
  else if ((tbox.x + tbox.width) > (gbox.x + gbox.width)) {
    tooltip.attr('text-anchor', 'end');
    tooltip.attr('dx', dx);
  }
  if (tbox.y < gbox.y) {
    tooltip.attr('dy', dy + tbox.height);
  }
}
