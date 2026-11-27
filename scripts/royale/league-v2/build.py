"""Build the six league islands using the project's authored architectural toolkit."""
import argparse
from math import cos, sin, tau, pi
from pathlib import Path
import random
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'kingdom-v3'))
from common import Craft, collection, create_palette, circles, IMAGES, PALETTE
from architecture import bastion, mural, opening, round_roof, crest, garden, lantern
from landscape import sculpt_island, outcrop, crystal
from vegetation import prototype, shrub

parser = argparse.ArgumentParser()
parser.add_argument('--textures', type=Path, required=True)
parser.add_argument('--out', type=Path, required=True)
parser.add_argument('--start', type=int, default=0)
parser.add_argument('--end', type=int, default=6)
parser.add_argument('--lod', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
args.out.mkdir(parents=True, exist_ok=True)

def orbit(craft, center, radius, tilt):
    x, y, z = center
    steps = 32 if args.lod else 64
    points = [(x+radius*cos(tau*i/steps), y+radius*sin(tau*i/steps)*cos(tilt),
               z+radius*sin(tau*i/steps)*sin(tilt)) for i in range(steps+1)]
    craft.taper('gold', points, [.026]*len(points), 5)

def causeway(craft, x, y, height, span):
    for i in range(18):
        t = i/17
        craft.block((x+span*(t-.5),y,height+.23*sin(pi*t)),(.16,.61,.105),'wood',.012)
        if i%3 == 0:
            for side in [-1,1]:
                craft.block((x+span*(t-.5),y+side*.30,height+.23*sin(pi*t)+.12),(.055,.06,.25),'trim',.017)
    for side in [-1,1]:
        points=[(x+span*(i/17-.5),y+side*.31,height+.18+.23*sin(pi*i/17)) for i in range(18)]
        craft.taper('wood',points,[.030]*18,5)

def architecture(index):
    g=Craft('Architecture')
    low=args.lod
    if index==0:
        mural(g,0,-.23,0,3.40,1.20,1.43,tiers=2,battlements=True)
        opening(g,0,-.86,.06,.73,1.13,style='wood')
        bastion(g,-1.48,-.26,0,.94,1.02,1.58,.65,0,'flank',low)
        bastion(g,1.43,-.22,0,.94,1.02,1.78,.75,1,'flank',low)
        bastion(g,.32,.83,0,1.49,1.29,2.65,.89,0,'keep',low)
        crest(g,0,-.94,1.29,.43)
        causeway(g,-1.25,-1.64,.09,1.83)
    elif index==1:
        for i,(x,y,z) in enumerate([(-1.42,.52,0),(0,.42,.35),(1.43,.71,.78)]):
            mural(g,x,y,z/2,1.12,.93,1.09+z,tiers=2)
            bastion(g,x,y,z,.76,.75,1.44+.17*i,.61,1,'belvedere',low)
        causeway(g,.12,-.48,.57,2.55)
        for i in range(4): crystal(g,(1.5+i*.24,-.95,.12),.15,.62+i*.09,.17,0)
    elif index==2:
        g.rings('stone',circles(0,.22,.02,[(1.25,0),(1.42,.18),(1.27,.31),(1.21,1.65),(1.33,1.76)],20))
        round_roof(g,0,.22,1.76,1.27,1.07,1,low)
        for x in [-.85,0,.85]: opening(g,x,-.96,.58,.35,.87,style='azure_glass')
        for x in [-1.58,1.56]: bastion(g,x,.46,0,.62,.65,1.43,.46,1,'belvedere',low)
        g.taper('iron',[(.02,.2,2.21),(.93,-.17,3.32)],[.23,.24],12)
        g.taper('gold',[(.91,-.15,3.28),(1.09,-.22,3.48)],[.25,.26],12)
        orbit(g,(0,.23,2.21),1.62,.42)
    elif index==3:
        mural(g,0,.19,0,2.95,1.58,1.78,tiers=2,battlements=True)
        bastion(g,.88,.57,0,1.1,1.08,2.75,.48,0,'keep',low)
        opening(g,0,-.7,.2,.7,1.1,style='wood')
        for x,z,r in [(-.71,1.29,.46),(.48,1.43,.38)]:
            for i in range(24):
                a=tau*i/24
                g.block((x+r*cos(a),-.69,z+r*sin(a)),(.10,.13,.11),'gold',.024)
            for i in range(8):
                a=tau*i/8
                g.taper('gold',[(x,-.76,z),(x+r*cos(a),-.76,z+r*sin(a))],[.038,.028],5)
        causeway(g,0,-1.64,.25,2.85)
    elif index==4:
        bastion(g,0,.37,0,1.22,1.06,2.55,.98,1,'keep',low)
        for i in range(7):
            a=tau*i/7
            x,y=1.57*cos(a),1.34*sin(a)
            crystal(g,(x,y,.10),.16+.055*(i%3),.63+.31*(i%4),.23,i%2)
        for x in [-1.15,1.15]:
            bastion(g,x,.27,0,.63,.68,1.49,.7,1,'belvedere',low)
        orbit(g,(0,.27,1.83),1.61,1.10)
    else:
        mural(g,0,-.10,0,3.67,1.55,1.62,tiers=2,battlements=True)
        for x,z in [(-1.63,1.83),(-.78,2.16),(.78,2.16),(1.63,1.83)]:
            bastion(g,x,.23,0,.63,.68,z,.80,1,'belvedere',low)
        bastion(g,0,.82,.32,1.22,1.08,2.62,1.05,0,'keep',low)
        for x in [-.61,0,.61]: opening(g,x,-.93,.41,.39,.98,style='azure_glass')
        orbit(g,(0,.18,2.19),2.28,.55)
        orbit(g,(0,.18,2.22),2.18,-.59)
    if index in [0,1,5]:
        for x,y,z in [(-1.48,-.26,2.16),(1.43,-.22,2.43)]:
            g.taper('gold',[(x,y,z),(x,y,z+.63)],[.021,.014],6)
            points=[(x,y,z+.60),(x+.57,y+.04,z+.54),(x+.48,y+.07,z+.41),(x,y,z+.39)]
            g.patch('cloth',points,[(0,1,2,3)])
            for angle in [0,pi/3,2*pi/3]:
                loop=[(x+.23+.088*cos(tau*i/20)*cos(angle)-.035*sin(tau*i/20)*sin(angle),
                       y-.012,z+.51+.088*cos(tau*i/20)*sin(angle)+.035*sin(tau*i/20)*cos(angle))
                      for i in range(21)]
                g.taper('gold',loop,[.0045]*21,4)
    for i in range(8):
        g.block((0,-1.97+i*.148,.05+i*.032),(1.08,.19,.12),'paving',.022)
    for side in [-1,1]:
        lantern(g,side*.66,-1.42,.2)
        garden(g,side*1.36,-1.14,.01,.32)
    if index==5 and 'roof' in g.groups:
        roof=g.groups.pop('roof')
        gilding=g.groups.get('gold')
        if gilding:
            start=len(gilding['verts'])
            gilding['polys'].extend(tuple(v+start for v in poly) for poly in roof['polys'])
            for key in ['verts','uv','tone','smooth','normals']: gilding[key].extend(roof[key])
        else:
            g.groups['gold']=roof
    return g

def render(index):
    scene=bpy.context.scene
    bpy.ops.object.camera_add(location=(6.8,-11.2,6.3))
    scene.camera=bpy.context.object
    scene.camera.rotation_euler=(Vector((0,0,.20))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    scene.camera.data.type='ORTHO';scene.camera.data.ortho_scale=9.55
    bpy.ops.object.light_add(type='AREA',location=(-4,-6,8))
    light=bpy.context.object;light.data.energy=1550;light.data.shape='DISK';light.data.size=6
    light.data.color=(1,.79,.54);light.rotation_euler=(-light.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.light_add(type='AREA',location=(4,3,5))
    light=bpy.context.object;light.data.energy=1100;light.data.size=6;light.data.color=(.46,.66,1)
    light.rotation_euler=(-light.location).to_track_quat('-Z','Y').to_euler()
    scene.world.color=(.38,.43,.55)
    scene.render.engine='CYCLES';scene.cycles.samples=10;scene.cycles.use_denoising=True
    scene.render.resolution_x=900;scene.render.resolution_y=780;scene.render.resolution_percentage=100
    scene.render.film_transparent=True
    scene.render.filepath=str(args.out/f'island-{index}.png')
    bpy.ops.render.render(write_still=True)

for index in range(args.start,args.end):
    bpy.ops.wm.read_factory_settings(use_empty=False)
    IMAGES.clear();PALETTE.clear()
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    create_palette(args.textures,args.lod)
    stage=collection(f'League {index+1}')
    terrain=Craft('Stratified cliffs and meadow')
    sculpt_island(terrain,(0,0,0),(2.67+index*.042,1.98+index*.047,2.42+index*.15),index+1,args.lod)
    rng=random.Random(index+241)
    for i in range(10 if args.lod else 22):
        a=i*2.39996
        outcrop(terrain,(2.39*cos(a),1.75*sin(a),-.4-rng.random()*.65),(.27+rng.random()*.28,.26,.27+rng.random()*.46),i)
    if index in [1,5]:
        sculpt_island(terrain,(2.95,.72,-.43),(.58,.43,.72),index+8,args.lod)
    list(terrain.objects(stage))
    list(architecture(index).objects(stage))
    for i,(x,y) in enumerate([(-2,-.17),(-1.8,-1.12),(1.93,-.64),(1.91,.88),(-1.61,1.02),(1.36,-1.38)]):
        for obj in prototype((i+index)%5,args.lod,False).objects(stage):
            obj.location=(x,y,.05);obj.scale=(.40,.40,.40);obj.rotation_euler.z=i*1.83
    for i in range(5):
        a=i*1.25
        for obj in shrub(i%3,args.lod).objects(stage):
            obj.location=(1.98*cos(a),1.52*sin(a),.05);obj.scale=(.38,.38,.38)
    if not args.lod:
        bpy.ops.file.pack_all()
        bpy.ops.wm.save_as_mainfile(filepath=str(args.out/f'island-{index}.blend'),compress=True)
    bpy.ops.export_scene.gltf(filepath=str(args.out/f'island-{index}{"-low" if args.lod else ""}.glb'),export_format='GLB',export_tangents=False)
    if not args.lod:
        render(index)
