"""Build the original menu castle in Blender. Run with --background --python and -- --out DIR."""
import argparse
import math
import random
import sys
from collections import defaultdict
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

cli = argparse.ArgumentParser()
cli.add_argument("--out", type=Path, required=True)
cli.add_argument("--low", action="store_true")
opts = cli.parse_args(sys.argv[sys.argv.index("--") + 1:])
opts.out.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
rng = random.Random(381)
buckets = defaultdict(lambda: ([], []))

def paint(name, rgb, roughness, metallic=0, emission=0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*rgb, 1)
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*rgb, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Emission Color"].default_value = (*rgb, 1)
    shader.inputs["Emission Strength"].default_value = emission
    return material

stone = [paint(f"Limestone {index + 1}", color, .86) for index, color in enumerate([
    (.52,.395,.29),(.68,.55,.42),(.45,.36,.30),(.58,.45,.34)])]
trim = paint("Ivory carving", (.74,.625,.45), .69)
base = paint("Shadowed stone joints", (.29,.22,.19), .93)
roof = [paint(f"Cobalt glazed tiles {i+1}", c, .42, .18) for i,c in enumerate([
    (.015,.033,.13),(.018,.060,.24),(.026,.091,.32),(.016,.048,.215),(.038,.108,.35)])]
gold = paint("Brushed gold and bronze", (.80,.43,.13), .31, .65)
shadow = paint("Deep windows and iron", (.023,.028,.047), .83)
amber = paint("Amber glass", (.92,.28,.025), .54, 0, .84)
water = paint("Fountain blue glass", (.020,.28,.46), .26, .18, .15)
gem = paint("Aether crystal", (.022,.45,.84), .23, .28, .55)
cloth = paint("Royal pennant", (.012,.048,.24), .89)

def stone_maps():
    size=128
    rng_map=np.random.default_rng(381)
    yy,xx=np.mgrid[0:size,0:size]*math.tau/size
    waviness=.5*np.sin(4*xx+3*yy)+.34*np.cos(3*xx-7*yy)
    height=(.7*np.sin(9*xx+2*yy+waviness)+.73*np.cos(5*yy+7*xx)+
            .28*np.cos(19*xx-7*yy)+.30*rng_map.normal(size=(size,size)))
    slopes=np.stack([-.13*(np.roll(height,-1,axis=1)-np.roll(height,1,axis=1)),
                     -.13*(np.roll(height,-1,axis=0)-np.roll(height,1,axis=0)),
                      np.ones_like(height)],axis=-1)
    slopes/=np.linalg.norm(slopes,axis=-1)[...,None]
    packed=np.concatenate([slopes*.5+.5,np.ones_like(height)[...,None]],axis=-1).astype('float32')
    image=bpy.data.images.new("Limestone micro relief",width=size,height=size,alpha=False)
    image.colorspace_settings.name="Non-Color"
    image.pixels.foreach_set(packed.reshape(-1))
    image.pack()
    for material in [*stone,trim,base]:
        nodes=material.node_tree.nodes
        sample=nodes.new("ShaderNodeTexImage")
        sample.image=image
        normal=nodes.new("ShaderNodeNormalMap")
        normal.inputs["Strength"].default_value=.40
        material.node_tree.links.new(sample.outputs["Color"],normal.inputs["Color"])
        material.node_tree.links.new(normal.outputs["Normal"],nodes.get("Principled BSDF").inputs["Normal"])

if not opts.low:
    stone_maps()

def build(material, vertices, polygons):
    points, faces = buckets[material]
    shift = len(points)
    points.extend(vertices)
    faces.extend(tuple(shift + i for i in face) for face in polygons)

def section(x, y, z, rings, count, materials, phase=0, aspect=1.0):
    """Stack custom radius-height rings. Per-ring materials split cladding, trim and roof."""
    loops = []
    for rad, h in rings:
        loops.append([(x + rad*math.cos(phase+j*math.tau/count),
                       y + rad*math.sin(phase+j*math.tau/count)*aspect,z+h) for j in range(count)])
    for j, (lower, upper) in enumerate(zip(loops, loops[1:])):
        for i in range(count):
            n=(i+1)%count
            material=materials(j,i) if callable(materials) else materials
            build(material,[lower[i],lower[n],upper[n],upper[i]],[(0,1,2,3)])
    mat=materials(0,0) if callable(materials) else materials
    build(mat,loops[0],[tuple(reversed(range(count)))])
    build(mat,loops[-1],[tuple(range(count))])

def block(x,y,z,sx,sy,sz,material,bevel=.025,heading=0):
    """Two shallow bevel loops produce real highlights on individual stones."""
    ca, sa = math.cos(heading), math.sin(heading)
    rings = []
    for height,inset in [(-sz/2,bevel),(-sz/2+bevel,0),(sz/2-bevel,0),(sz/2,bevel)]:
        dx,dy=sx/2-inset,sy/2-inset
        rings.extend([(x+ca*a-sa*b,y+sa*a+ca*b,z+height) for a,b in [(-dx,-dy),(dx,-dy),(dx,dy),(-dx,dy)]])
    faces = [(3,2,1,0),(12,13,14,15)]
    faces += [(4*k+i,4*k+(i+1)%4,4*(k+1)+(i+1)%4,4*(k+1)+i)
              for k in range(3) for i in range(4)]
    build(material,rings,faces)

def stone_arch(x,y,z,w,h,angle=0,door=False):
    """Set a recessed arched opening, mullions and twelve facing stones on one wall."""
    ca,sa=math.cos(angle),math.sin(angle)
    def pt(u,v,d=0):
        return (x+ca*u+sa*d,y+sa*u-ca*d,z+v)
    spring=h-w
    radians=[math.pi*i/10 for i in range(11)]
    points=[pt(-w,0),pt(w,0),*[pt(w*math.cos(t),spring+w*math.sin(t)) for t in radians]]
    build(shadow,points,[tuple(range(len(points)))])
    for i in (-1,1):
        for j in range(3):
            center=pt(i*(w+.043),spring*(j+.5)/3,.020)
            block(*center,.090,.091,spring/3-.011,stone[(j+i)%4],.013,angle)
    for i in range(10):
        a,b=radians[i]+.013,radians[i+1]-.013
        v=[pt(r*math.cos(t),spring+r*math.sin(t),depth)
           for depth in [-.004,.078] for r,t in [(w,a),(w+.095,a),(w+.095,b),(w,b)]]
        build(trim if i in (4,5) else stone[i%4],v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
    glow=[pt(-w*.81,.05,.011),pt(w*.81,.05,.011),*[pt(w*.81*math.cos(t),spring+w*.81*math.sin(t),.011) for t in radians]]
    build(amber,glow,[tuple(range(len(glow)))])
    if not door:
        block(*pt(0,h*.415,.028),.035,.044,h*.78,gold,.007,angle)
        block(*pt(0,.006,.091),w*2+.22,.21,.076,trim,.024,angle)
    else:
        for i in range(4):
            block(*pt(0,-.14-i*.092,.20+i*.14),2*w+.36+i*.09,.32,.11,stone[i%4],.032,angle)
        for i in (-1,1):
            block(*pt(i*(w+.22),h*.41,.12),.13,.22,h*.88,trim,.039,angle)

def tower(x,y,z,r,h,roof_h,sides=12,windows=3):
    phase=math.pi/sides-math.pi/2
    section(x,y,z,[(r*1.13,0),(r*1.14,.09),(r,.16),(r*.89,h-.12),(r*1.10,h),(r*1.12,h+.075),(r*.96,h+.235)],sides,
            lambda row,side: trim if row in (1,4) else (gold if row==5 else stone[(side//3)%4]),phase)
    levels=round(h/.24)
    for j in range(1,levels):
        frac=j/levels
        rad=r*(.997-.106*frac)
        section(x,y,z,[(rad,frac*h-.017),(rad,frac*h+.009),(rad-.009,frac*h+.021)],sides,
                base if j%4 else trim,phase)
    for i in range(0,sides,max(1,sides//4)):
        a=phase+i*math.tau/sides
        for j in range(3):
            zz=z+.19+(j+.5)*(h-.32)/3
            rr=r*(.99-.10*j/3)
            block(x+rr*math.cos(a),y+rr*math.sin(a),zz,.105,.15,(h-.4)/3,trim,.021,a+math.pi/2)
    for a in [-math.pi/2, -math.pi/2-.97, -math.pi/2+.97][:windows]:
        d=r*.928
        stone_arch(x+d*math.cos(a),y+d*math.sin(a),z+.38*h,r*.18,min(.72,h*.48),a+math.pi/2)
    for i in range(sides):
        a=phase+(i+.5)*math.tau/sides
        for height in [.11,.18]:
            block(x+r*math.cos(a),y+r*math.sin(a),z+h+height,.15*r,.125,.12,trim if i%3 else gold,.027,a)
    n=sides if opts.low else sides*2
    ring_heights=[0,.075,.185,.32,.47,.62,.755,.865,.945,1]
    ring_widths=[1.18,1.14,1.02,.86,.69,.55,.40,.25,.116,.028]
    section(x,y,z+h+.204,[(r*width,roof_h*height) for width,height in zip(ring_widths,ring_heights)],n,
            lambda row,i: roof[(i+(row+1)*2+int(rng.random()*3))%len(roof)],phase)
    for j in (1,3,5,7):
        rad=r*ring_widths[j]+.009
        hh=z+h+.204+roof_h*ring_heights[j]
        section(x,y,hh,[(rad-.009,-.024),(rad+.013,0),(rad-.014,.026)],n,roof[0],phase)
    for i in range(4):
        a=phase+i*math.tau/4
        for j in range(8):
            r1,r2=r*ring_widths[j+1],r*ring_widths[j]
            h1,h2=[z+h+.217+roof_h*ring_heights[k] for k in [j+1,j]]
            off=.016
            xyz=[(x+rr*math.cos(a+delta),y+rr*math.sin(a+delta),zz) for rr,zz,delta in
                 [(r2,h2,-off),(r2,h2,off),(r1,h1,off),(r1,h1,-off)]]
            build(gold,xyz,[(0,1,2,3)])
    for j in range(0 if opts.low else 2,sides*2,8 if opts.low else 5):
        a=phase+j*math.tau/n
        for k in [1,2,3,4,5,6]:
            rr=r*ring_widths[k]+.024
            z_tile=z+h+.204+roof_h*ring_heights[k]
            block(x+rr*math.cos(a),y+rr*math.sin(a),z_tile,.072*r,.044,.027,roof[(j+k)%5],.008,a)
    cap=z+h+roof_h+.19
    section(x,y,cap,[(.075,0),(.090,.067),(.046,.132),(.025,.315),(.004,.404)],8,gold)
    return cap+.36

def wall(x,y,z,w,depth,h,angle=0):
    ca,sa=math.cos(angle),math.sin(angle)
    def b(a,d,zz,ww,dd,hh,mat,edge=.025):
        block(x+a*ca-d*sa,y+a*sa+d*ca,zz,ww,dd,hh,mat,edge,angle)
    b(0,0,z+h/2,w,depth,h,base)
    rows=max(3,round(h/.23))
    cols=max(3,round(w/.43))
    for j in range(rows):
        for i in range(cols+1):
            a=max(-w/2,(i-.5*j%1-.5)*w/cols-w/2)
            d=min(w/2,(i-.5*j%1+.5)*w/cols-w/2)
            if d-a<.12: continue
            b((a+d)/2,-depth*.5,z+(j+.5)*h/rows,d-a-.012,.102,h/rows-.014,rng.choice(stone),.022)
    b(0,0,z+h,w+.12,depth+.14,.105,trim)
    b(0,0,z+h-.09,w+.093,depth+.11,.042,gold,.012)
    for i in range(cols):
        b(-w/2+(i+.5)*w/cols,0,z+h+.145,w/cols*.63,depth*.91,.222,rng.choice(stone),.025)

def spired_hall():
    wall(0,.65,.20,2.94,1.53,2.36)
    wall(0,1.54,.45,1.73,1.08,2.59)
    for x in [-1.06,-.55,0,.55,1.06]:
        stone_arch(x,-.211,1.61,.148,.60)
    section(0,.52,2.55,[(1.69,0),(1.41,.18),(.97,.51),(.51,.83),(.045,1.04)],4,
            lambda row,side:roof[(row+side)%5],math.pi/4,aspect=.80)
    wall(0,-.92,.068,2.24,.74,1.19)
    stone_arch(0,-1.38,.34,.37,.87,door=True)
    block(0,-.35,1.48,1.72,.47,.106,trim,.024)
    block(0,-.58,1.59,1.71,.058,.051,gold,.014)
    for i in range(9):
        block((i-4)*.182,-.57,1.57,.053,.083,.20,trim,.013)
    for sign in [-1,1]:
        x=sign*1.12
        for j in range(4):
            block(x,-.34,1.65+j*.180,.15,.17,.15,trim,.022)
        block(x,-.34,2.35,.25,.235,.10,gold,.023)
        for j in range(8):
            half=.155-j*.007
            build(cloth,[(x-half,-.292,2.16-j*.071),(x+half,-.292,2.16-j*.071),
                        (x+half*.95,-.30,2.09-j*.071),(x-half*.95,-.30,2.09-j*.071)],[(0,3,2,1)])
        build(gold,[(x,-.311,2.105),(x+.077,-.311,1.97),(x,-.311,1.84),(x-.077,-.311,1.97)],[(0,3,2,1)])
    for x in [-.81,.81]:
        stone_arch(x,-1.36,.46,.119,.46)
    for x in [-1.02,1.02]:
        block(x,-1.335,1.20,.13,.17,.18,gold,.029)
    section(0,-1.442,1.06,[(.0001,0),(.118,.14),(.0001,.28)],4,gem,math.pi/4)
    for z in [1.39,1.49]:
        block(0,-1.43,z,2.36,.16,.072,gold if z>1.45 else trim,.023)

section(0,0,.01,[(3.10,0),(3.10,.115),(2.95,.18),(2.83,.24)],16,stone[0],math.pi/16,.74)
spired_hall()
tower(0,1.47,.58,.64,2.81,1.33)
tower(-1.20,.76,.29,.57,2.50,1.13)
tower(1.33,.88,.25,.58,2.28,1.02)
tower(-2.05,-.30,.13,.52,1.56,.94)
tower(2.08,-.17,.10,.52,1.77,.99)
tower(-1.12,-1.01,.16,.37,1.77,.77,10,1)
tower(1.11,-1.09,.16,.35,1.62,.79,10,1)
for sign in [-1,1]:
    wall(sign*1.66,-1.23,.19,1.21,.25,.79,angle=sign*.18)
    wall(sign*2.71,.37,.14,2.08,.25,.66,angle=sign*math.pi/2)
    wall(sign*1.76,1.95,.17,1.63,.25,.73)
    for j in range(4):
        block(sign*(2.49+j*.126),-.58+j*.12,.20-j*.035,.35,.25,.093,trim,.021,sign*.65)
    for j in range(6):
        block(sign*(.93+j*.22),-2.01+.045*rng.random(),.10,.212,.32,.089,rng.choice(stone),.025,sign*.29)
for x in [-1.72,1.72]:
    section(x,-1.48,.25,[(.48,0),(.49,.065),(.44,.13),(.41,.21),(.35,.22)],12,trim)
    section(x,-1.48,.302,[(.34,0),(.34,.134)],12,water)
    section(x,-1.48,.39,[(.104,0),(.144,.12),(.0,.41)],6,gem)

for i,(material,(points,faces)) in enumerate(buckets.items()):
    geo=bpy.data.meshes.new(material.name+" geometry")
    geo.from_pydata(points,[],faces)
    geo.update()
    if not opts.low and material in [*stone,trim,base]:
        layer=geo.uv_layers.new(name="Stone projection")
        for poly in geo.polygons:
            axis=max(range(3),key=lambda j: abs(poly.normal[j]))
            projection=[(1,2),(0,2),(0,1)][axis]
            for idx in poly.loop_indices:
                co=geo.vertices[geo.loops[idx].vertex_index].co
                layer.data[idx].uv=(co[projection[0]]*.88,co[projection[1]]*.88)
    geo.materials.append(material)
    obj=bpy.data.objects.new(material.name,geo)
    bpy.context.collection.objects.link(obj)

if not opts.low:
    bpy.ops.wm.save_as_mainfile(filepath=str(opts.out/"citadel-cinematic.blend"))
stem="citadel-cinematic-low" if opts.low else "citadel-cinematic"
bpy.ops.export_scene.gltf(filepath=str(opts.out/(stem+".glb")), export_format="GLB", export_yup=True)
