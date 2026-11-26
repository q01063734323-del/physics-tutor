"""Author and render the Kingdom 3.0 assets, then export two browser LODs."""
import argparse,json,math,random,sys
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0,str(Path(__file__).resolve().parent))
from common import create_palette, collection, PALETTE
from architecture import build_palace
from vegetation import prototype, shrub, groundcover, SPECIES
from landscape import make_landscape, demo_water, FALLS

parser=argparse.ArgumentParser()
parser.add_argument('--textures',type=Path,required=True)
parser.add_argument('--out',type=Path,required=True)
parser.add_argument('--low',action='store_true')
parser.add_argument('--render',action='store_true')
parser.add_argument('--render-only',action='store_true')
parser.add_argument('--select',nargs='*',default=[])
opts=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
opts.out.mkdir(parents=True,exist_ok=True)
opts.textures=opts.textures.resolve()

DESIGN=[
 ('A • Sunrise',(-8.8,-20.3,8.6),(0,0,.91),42,(-6,-11,13),3.9,.27,'ffcc9b'),
 ('B • Clear afternoon',(8.6,-21.8,9.7),(.12,0,1.03),45,(-7,-5,13),3.75,.34,'ffe0b7'),
 ('C • Late sunlight',(1.8,-22.0,10.8),(0,0,.99),42,(-10,4,8),3.75,.24,'ffc591')
]
TREE_SITES=[
 (0,-3.44,-1.37,.23,1.05,.12),(2,3.19,-1.34,.21,.81,1.19),(4,2.88,-2.08,.18,.76,-.80),
 (3,-1.52,-2.38,.21,.47,.7),(1,-3.7,.61,.25,.77,.4),(1,3.57,-.19,.25,.66,2.1),
 (2,-2.58,-1.35,.20,.48,.2),(4,-3.92,-.28,.23,.68,.8),(0,3.03,1.03,.19,.76,4.22),
 (1,-2.92,1.91,.20,.70,.5),(3,2.95,.77,.25,.68,2.5),(1,-8.26,5.86,1.68,.42,2),
 (1,-8.81,5.7,1.66,.51,1.5),(0,-5.55,-1.77,-.14,.78,1),(4,-5.37,-2.28,-.20,.62,-.80),
 (2,5.84,.96,-.62,.64,.24),(0,5.99,1.84,-.62,.45,1),(3,5.33,1.31,-.64,.44,2),
 (1,8.98,7.4,2.18,.59,2.1),(1,8.09,7.85,2.13,.47,1),(1,8.9,6.60,2.1,.43,.1),
 (0,-7.26,-5.40,-2.99,.85,.8),(4,7.33,-5.43,-3.54,.77,-.7),
]
SHRUB_SITES=[
 (-3.72,-1.76,.17),(-3.37,-2.05,.19),(-2.89,-2.60,.20),(-1.42,-2.75,.20),
 (-1.84,-2.45,.20),(1.83,-2.64,.16),(2.70,-1.84,.21),(3.47,-1.72,.20),
 (3.58,-1.39,.20),(4.15,-.87,.20),(3.60,-.2,.20),(3.23,.51,.23),
 (-3.72,.58,.24),(-2.86,1.62,.21),(3.45,1.4,.23),(-5.65,-2.23,-.14),
 (-4.83,-2.09,-.13),(5.81,.6,-.66),(-7.6,-5.5,-2.97),(7.41,-5.07,-3.55),
]

def point_at(obj,target):
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()

def light(scene,name,kind,energy,loc,color,size):
    data=bpy.data.lights.new(name,kind)
    data.energy=energy
    data.color=color
    if kind=='AREA': data.shape='DISK';data.size=size
    else: data.angle=size
    result=bpy.data.objects.new(name,data)
    scene.collection.objects.link(result)
    result.location=loc
    return result

def rig(scene,name,position,target,lens,sun_pos,power,world,color):
    cam_data=bpy.data.cameras.new(name)
    cam=bpy.data.objects.new(name,cam_data)
    scene.collection.objects.link(cam)
    cam.location=position
    cam.data.lens=lens
    point_at(cam,target)
    scene.camera=cam
    for k in list(scene.objects):
        if k.type=='LIGHT': bpy.data.objects.remove(k,do_unlink=True)
    s=light(scene,'Warm key','SUN',power,sun_pos,(1,.82,.66),.21)
    point_at(s,target)
    fill=light(scene,'Skylight', 'AREA',1120,(8,-5,11),(.64,.77,1),10)
    point_at(fill,target)
    rim=light(scene,'Cool rim','AREA',1430,(0,6,12),(.59,.73,1),9)
    point_at(rim,target)
    scene.world=bpy.data.worlds.new('Cloud daylight')
    scene.world.use_nodes=True
    bg=scene.world.node_tree.nodes['Background']
    bg.inputs[0].default_value=(.50,.64,.89,1)
    bg.inputs[1].default_value=world

def local_bake(objects, affected, dist=.43):
    # Cast five weighted hemisphere rays per spatially shared sample. Bake contacts to vertex color.
    positions=[]; faces=[]
    for ob in objects:
        if ob.type!='MESH':continue
        n=len(positions)
        positions.extend(ob.matrix_world@v.co for v in ob.data.vertices)
        faces.extend(tuple(n+q for q in poly.vertices) for poly in ob.data.polygons)
    bvh=BVHTree.FromPolygons(positions,faces,epsilon=.0001)
    total=0
    for ob in affected:
        cache={}
        mesh=ob.data
        color=mesh.color_attributes.active_color
        if not color: continue
        for poly in mesh.polygons:
            normal=poly.normal
            if normal.length<.2: continue
            s=normal.cross(Vector((0,1,0)))
            if s.length<.1: s=normal.cross(Vector((1,0,0)))
            s.normalize()
            t=normal.cross(s)
            rays=[normal,(normal+s*.91).normalized(),(normal-s*.91).normalized(),
                  (normal+t*.91).normalized(),(normal-t*.91).normalized()]
            for loop in poly.loop_indices:
                v=mesh.vertices[mesh.loops[loop].vertex_index].co
                key=tuple(round(x,3) for x in v)+tuple(round(q,1) for q in normal)
                amount=cache.get(key)
                if amount is None:
                    origin=v.lerp(poly.center,.12)+normal*.019
                    scores=[bvh.ray_cast(origin,r,dist)[3] for r in rays]
                    occlusion=sum(1-min(d/dist,1) for d in scores if d is not None)/len(rays)
                    amount=1-.46*occlusion
                    cache[key]=amount
                before=color.data[loop].color
                color.data[loop].color=(*[before[i]*amount for i in range(3)],1)
                total+=1
    return total

def build():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)
    create_palette(opts.textures,opts.low)
    scene=bpy.context.scene
    main=collection('01 • Aether Court')
    env=collection('02 • Islands and bridge')
    detail=collection('03 • Courtyard and creeks')
    groves=collection('04 • Foliage prototypes and linked placements')
    water=collection('05 • Water, offline proxy')
    architecture,flags=build_palace(opts.low)
    palace=list(architecture.objects(main))
    core,satellites,shore=make_landscape(opts.low)
    terrain=list(core.objects(env))
    islands=[o for craft in satellites for o in craft.objects(env)]
    details=[*shore.objects(detail),*groundcover(opts.low).objects(detail)]
    batch=palace+terrain+islands+details
    scene.view_layers[0].update()
    count=local_bake(palace+terrain+details,palace+terrain+details,dist=.42)
    print(f'Contact AO baked into {count} mesh corners',flush=True)
    prototypes=[]
    placements=[[] for _ in range(8)]
    for spec in TREE_SITES: placements[spec[0]].append(spec[1:])
    for i,(x,y,z) in enumerate(SHRUB_SITES): placements[5+i%3].append((x,y,z,.92+i%4*.10,i*.7))
    for i in range(8):
        craft=prototype(i,opts.low) if i<5 else shrub(i-5,opts.low)
        parts=list(craft.objects(groves))
        parent=bpy.data.objects.new(f'VEG_{i}',None)
        groves.objects.link(parent)
        for o in parts: o.parent=parent
        prototypes.extend([parent,*parts])
        for j,(x,y,z,scale,angle) in enumerate(placements[i]):
            if opts.low and j%3==1: continue
            for part in parts:
                node=bpy.data.objects.new(f'{craft.name} / site {j+1}',part.data)
                groves.objects.link(node)
                node.location=(x,y,z)
                node.scale=(scale,)*3
                node.rotation_euler.z=angle
        parent.hide_render=True
        for part in parts: part.hide_render=True
    for o in demo_water().objects(water):
        o['browser_uses_shader']=True
    for i,(x,y,z,scale) in enumerate(flags):
        name=f'Pennant {i+1}'
        from common import Craft
        g=Craft(name)
        g.taper('gold',[(x,y,z+.19),(x,y,z+.87*scale)],[.022,.014],6)
        pts=[(x,y,z+.83*scale),(x+.9*scale,y+.06,z+.76*scale),
             (x+.76*scale,y+.12,z+.69*scale),(x+.84*scale,y+.08,z+.57*scale),
             (x,y,z+.59*scale)]
        g.patch('cloth',pts,[(0,1,2,3,4)])
        list(g.objects(water))
    rig(scene,*DESIGN[0])
    scene['browser_water']='Curved curtains, forward lighting, hydraulic splash and layered mist.'
    scene.render.engine='CYCLES'
    scene.cycles.samples=13
    scene.cycles.use_denoising=True
    scene.render.film_transparent=True
    scene.render.resolution_x=1320;scene.render.resolution_y=864
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    if not opts.low:
        bpy.ops.wm.save_as_mainfile(filepath=str(opts.out/'Kingdom_3_0_Environment.blend'),compress=True)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in batch+prototypes:
        ob.hide_set(False)
        ob.select_set(True)
    stem='kingdom-low' if opts.low else 'kingdom-high'
    bpy.ops.export_scene.gltf(filepath=str(opts.out/(stem+'.glb')),export_format='GLB',use_selection=True,
        export_image_format='AUTO',export_tangents=False,export_vertex_color='ACTIVE',export_extras=False)
    if not opts.low:
        (opts.out/'layout.json').write_text(json.dumps({'trees':placements,'water':FALLS,'flags':flags},separators=(',',':'))+'\n')

def render_scene():
    scene=bpy.context.scene
    scenes={
      'composition-a':(DESIGN[0],(1080,680),10),
      'composition-b':(DESIGN[1],(1080,680),10),
      'composition-c':(DESIGN[2],(1080,680),10),
      'architecture':(('Architecture',(-3.8,-9.8,5.5),(.0,-.38,2.58),53,(-7,-10,12),3.7,.32,'ffdfb7'),(1120,860),15),
      'gates':(('Gate and carvings',(2.87,-7.1,4),(.42,-1.33,1.22),56,(-7,-8,11),3.8,.34,'ffdfb7'),(1000,750),15),
      'rock':(('Rock and aether seams',(5.9,-9.6,-.66),(2.4,-1.95,-1.63),53,(-6,-13,12),3.4,.30,'ffd3b2'),(1080,790),16),
      'water':(('Falls',(3.9,-8.1,1.7),(1.09,-2.61,-1.08),46,(-8,-7,13),3.5,.34,'ffce9b'),(1080,790),14)
    }
    for name,(preset,size,samples) in scenes.items():
        if opts.select and name not in opts.select: continue
        rig(scene,*preset)
        scene.render.resolution_x,scene.render.resolution_y=size
        scene.cycles.samples=samples
        scene.render.filepath=str(opts.out/(name+'-rgba.png'))
        bpy.ops.render.render(write_still=True)
    if not opts.select or 'vegetation' in opts.select or 'materials' in opts.select:
        spec=collection('06 • Asset contact sheet')
        for coll in [c for c in bpy.data.collections if c!=spec]:
            for o in coll.objects:o.hide_render=True
        if not opts.select or 'vegetation' in opts.select:
            g=__import__('common').Craft('Vegetation stand')
            g.block((0,.2,-.18),(10.4,3.5,.26),'joint',.09)
            list(g.objects(spec))
            for i in range(8):
                authored=prototype(i,False) if i<5 else shrub(i-5,False)
                for o in authored.objects(spec):
                    o.location=((i-2)*1.78,0,0) if i<5 else ((i-6)*1.4,-1.07,0)
            rig(scene,'Vegetation study',(1.1,-12,5.4),(0,0,.53),48,(-7,-9,12),3.6,.29,'ffe0b7')
            scene.render.resolution_x,scene.render.resolution_y=(1400,700)
            scene.cycles.samples=15
            scene.render.filepath=str(opts.out/'vegetation-rgba.png')
            bpy.ops.render.render(write_still=True)
            for o in spec.objects:o.hide_render=True
        if not opts.select or 'materials' in opts.select:
            g=__import__('common').Craft('Material swatches')
            from common import circles
            for i,mat in enumerate(PALETTE):
                x=(i%6-2.5)*1.10
                y=(i//6-1)*1.04
                g.rings(mat,circles(x,y,.04,[(.23,0),(.34,.12),(.42,.27),(.41,.49),(.27,.68),(.05,.75)],16),smooth=True)
            list(g.objects(spec))
            rig(scene,'Material study',(0,-7,7.5),(0,0,.3),45,(-6,-7,9),3.65,.29,'ffe0b7')
            scene.render.resolution_x,scene.render.resolution_y=(1170,840)
            scene.cycles.samples=17
            scene.render.filepath=str(opts.out/'materials-rgba.png')
            bpy.ops.render.render(write_still=True)

if not opts.render_only: build()
else:
    bpy.ops.wm.open_mainfile(filepath=str(opts.out/'Kingdom_3_0_Environment.blend'))
    from common import PALETTE
    for prefix in ['stone','trim','joint','cliff','top','paving','roof','gold','iron','wood','glass','seam','cloth','leaves','gem','wet','foam']:
        PALETTE[prefix]=next(o.active_material for o in bpy.data.objects if o.type=='MESH' and o.name.endswith(' / '+prefix))
if opts.render or opts.render_only: render_scene()
