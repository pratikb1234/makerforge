// P1 backlog — kerf compensation (round-join polygon offset + hole nesting)
// and DXF R12 export. Tests the shipped functions in laser-studio.html.
const { loadFunctions } = require('./extract');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ✅', m)) : (fail++, console.log('  ❌', m)); };

const prelude = 'const pointInPoly=(x,y,poly)=>{let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const xi=poly[i].x,yi=poly[i].y,xj=poly[j].x,yj=poly[j].y;const inter=((yi>y)!=(yj>y))&&(x<(xj-xi)*(y-yi)/((yj-yi)||1e-9)+xi);if(inter)inside=!inside;}return inside;};';
const { offsetPolygon, applyKerf, genDXF } =
  loadFunctions('laser-studio.html', ['offsetPolygon', 'applyKerf', 'genDXF'], prelude);

const area = pts => { let a = 0; const p = pts.filter((q,i)=>i===0||q.x!==pts[0].x||q.y!==pts[0].y||i<pts.length-1); let n=p.length; for (let i=0;i<n;i++){const u=p[i],v=p[(i+1)%n];a+=u.x*v.y-v.x*u.y;} return Math.abs(a/2); };
const span = (pts,k) => Math.max(...pts.map(p=>p[k])) - Math.min(...pts.map(p=>p[k]));
const sq = (x,y,s) => [{x,y},{x:x+s,y},{x:x+s,y:y+s},{x,y:y+s},{x,y}];

// ---------- offsetPolygon ----------
let o = offsetPolygon(sq(0,0,10), 1);
ok(Math.abs(span(o,'x')-12)<0.01 && Math.abs(span(o,'y')-12)<0.01, 'square +1: bbox grows to 12×12');
ok(Math.abs(area(o)-(144-(4-Math.PI)))<0.3, `square +1: area ≈ 143.14 w/ round corners (got ${area(o).toFixed(2)})`);

o = offsetPolygon(sq(0,0,10), -1);
ok(area(o)>62 && area(o)<67, `square −1: area ≈ 64 (got ${area(o).toFixed(2)})`);

// winding-independent: CW input also grows with +delta
const cw = sq(0,0,10).reverse();
o = offsetPolygon(cw, 1);
ok(area(o)>area(cw), 'CW ring: +delta still grows the area');

// zero/near-zero delta = identity
o = offsetPolygon(sq(0,0,10), 0);
ok(o.length===5 && o[1].x===10, 'delta 0: returns copy');

// circle: +0.5 offset increases effective radius by 0.5
const circ=[]; for(let i=0;i<64;i++){const a=Math.PI*2*i/64;circ.push({x:10*Math.cos(a),y:10*Math.sin(a)});}
o = offsetPolygon(circ, 0.5);
const rAvg = o.reduce((s,p)=>s+Math.hypot(p.x,p.y),0)/o.length;
ok(Math.abs(rAvg-10.5)<0.02, `circle r10 +0.5 → r≈10.5 (got ${rAvg.toFixed(3)})`);

// ---------- applyKerf: outer grows, hole shrinks ----------
const shapes=[
  {layerIndex:0,mode:'cut',closed:true,pts:sq(0,0,40)},        // outer part
  {layerIndex:0,mode:'cut',closed:true,pts:sq(15,15,10)},      // hole inside it
  {layerIndex:1,mode:'cut',closed:true,pts:sq(60,0,10)},       // other layer — untouched (kerf 0)
];
applyKerf(shapes,[{mode:'cut',kerf:0.2},{mode:'cut',kerf:0}]);
ok(Math.abs(span(shapes[0].pts,'x')-40.2)<0.01, 'kerf: outer profile offset OUTWARD by kerf/2');
ok(Math.abs(span(shapes[1].pts,'x')-9.8)<0.01, 'kerf: hole offset INWARD by kerf/2');
ok(span(shapes[2].pts,'x')===10, 'kerf: layer with kerf 0 untouched');

// engrave layers never offset
const eng=[{layerIndex:0,mode:'engrave',closed:true,pts:sq(0,0,10)}];
applyKerf(eng,[{mode:'engrave',kerf:0.4}]);
ok(span(eng[0].pts,'x')===10, 'kerf: engrave layers untouched');

// ---------- genDXF ----------
const sc={bed:{w:300,h:200},layers:[{name:'Cut Layer!',color:'#f00',mode:'cut'},{name:'Engrave',color:'#00f',mode:'engrave'}],
  shapes:[
    {layerIndex:0,mode:'cut',closed:true,pts:sq(10,10,20)},
    {layerIndex:1,mode:'engrave',closed:false,pts:[{x:0,y:0},{x:5,y:5}]},
  ]};
const dxf=genDXF(sc);
const lines=dxf.split('\r\n');
ok(lines[0]==='0'&&lines[1]==='SECTION', 'DXF: starts with SECTION');
ok(lines[lines.length-1]==='EOF', 'DXF: ends with EOF');
ok(dxf.includes('AC1009'), 'DXF: R12 version tag');
ok((dxf.match(/\r\nPOLYLINE\r\n/g)||[]).length===2, 'DXF: one POLYLINE per shape');
ok((dxf.match(/\r\nVERTEX\r\n/g)||[]).length===4+2, 'DXF: vertex count (closed ring deduped)');
ok(dxf.includes('CUT_LAYER_'), 'DXF: layer names sanitized');
// y flip: input y=10 → 200-10=190
ok(dxf.includes('190.000'), 'DXF: Y flipped to CAD Y-up');
// closed flag: group 70 value 1 for the closed shape
const pl=dxf.indexOf('POLYLINE');
ok(dxf.slice(pl,pl+120).includes('\r\n70\r\n1'), 'DXF: closed polyline flagged 70/1');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
