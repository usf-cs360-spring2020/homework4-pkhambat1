var svg = d3.select("svg"),
width = +svg.attr("width"),
height = +svg.attr("height"),
g = svg.append("g").attr("transform", translate((width / 2 + 40), (height / 2 + 90)));

let numberFormat = d3.format(".2~s");
let linkParams = {
    name: '',
    depth: 0
};

let modifyRow = d => ({
    callTypeGroup: d.callTypeGroup,
    callType: d.callType,
    unitType: d.unitType,
    count: +d.count,
    parent: `${d.callType} (${d.callTypeGroup})`,
    name: `${d.unitType} (${d.callType}, ${d.callTypeGroup})` // Ensure unique names!!
});

var stratify = d3.stratify()
.parentId(function (d) { return d.id.substring(0, d.id.lastIndexOf(".")); });

var tree = d3.tree()
.size([2 * Math.PI, 500])
.separation(function (a, b) { return (a.parent == b.parent ? 1 : 2) / a.depth; });

var svg = d3.select("svg"),
width = +svg.attr("width"),
height = +svg.attr("height"),
g = svg.append("g").attr("transform", translate((width / 2 + 40), (height / 2 + 90)));


linkParams.name = 'All Incidents';

d3.csv("fdcsf.csv", modifyRow).then(data => {
    data = data.filter(d => d.callTypeGroup === 'Alarm' || d.callTypeGroup === 'Potentially Life-Threatening' || d.callTypeGroup === 'Non Life-threatening' || d.callTypeGroup === 'Fire');
    let depth1 = data.map(d => ({
        name: d.callTypeGroup,
        parent: 'All Incidents',
        count: 0
    }));
    
    let depth2 = data.map(d => ({
        name: `${d.callType} (${d.callTypeGroup})`, 
        parent: d.callTypeGroup, 
        count: 0
      }));
    
    depth1 = removeDuplicates(depth1, item => item.name);
    depth2 = removeDuplicates(depth2, item => item.name);
    depth0 = { name: 'All Incidents', parent: '' };
    let tree = [...data, ...depth2, ...depth1, depth0];
    
    // Make the hierarchy
    let stratified = d3.stratify()
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
    let selectedRoot = null;
    stratified.each(function (node) {
      if (node.data.name == linkParams.name) {
        selectedRoot = node;
      }
    });
    //  Actually draw node link
    let module = selectedRoot.copy();
    let height = 500, pad = 14;
    let layout = d3.partition().size([width - 2 * pad, height - 2 * pad]);
    // uses the "value" attribute (currently file siz
    layout(module);
    
    let plot = svg.append("g")
    .attr("id", "plot")
    .attr("transform", translate(pad, pad));
    
    let rects = plot.selectAll("rect")
    .data(module.descendants())
    .enter()
    .append("rect")
    .attr("x", function (d) { return d.x0; })
    .attr("y", function (d) { return d.y0; })
    .attr("width", function (d) { return d.x1 - d.x0; })
    .attr("height", function (d) { return d.y1 - d.y0; })
    .attr("id", function (d) { return d.data.name; })
    .attr("class", "node")
    .style("fill", function (d) { return color(d.depth) });
    setupEvents(plot, rects, true);
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
        update.classed('selected', true);
        
        if (raise) {
            update.raise();
        }
    });
    
    selection.on('mouseout.highlight', function (d) {
        let path = d3.select(this).datum().path(selection.data()[0]);
        let update = selection.data(path, node => node.data.name);
        update.classed('selected', false);
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
