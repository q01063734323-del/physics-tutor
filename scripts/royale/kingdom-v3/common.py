"""UVs, authoring meshes and small reusable parts for the Aether Court diorama."""
from collections import defaultdict
from math import cos, sin, pi, tau
from pathlib import Path
import random

import bpy
from mathutils import Vector

R = random.Random(379813)
PALETTE = {}
TEXTURES = None
IMAGES = {}

def rgb(value):
    channels = tuple(int(value[i:i+2], 16)/255 for i in (0, 2, 4))
    return tuple(c/12.92 if c < .04045 else ((c+.055)/1.055)**2.4 for c in channels)

def tint(a, b, t):
    return tuple(x*(1-t)+y*t for x,y in zip(a,b))

def sample_image(name, linear=False):
    key=(name,linear)
    if key not in IMAGES:
        image=bpy.data.images.load(str(TEXTURES/name))
        if linear: image.colorspace_settings.name='Non-Color'
        image.pack()
        IMAGES[key]=image
    return IMAGES[key]

def surface(name, color, roughness, metallic=0, family=None, normal=.50, tiles=False, emission=0):
    material=bpy.data.materials.new(name)
    material.use_nodes=True
    material.diffuse_color=(*rgb(color),1)
    nd=material.node_tree.nodes
    link=material.node_tree.links.new
    shader=nd.get('Principled BSDF')
    shader.inputs['Base Color'].default_value=(*rgb(color),1)
    shader.inputs['Roughness'].default_value=roughness
    shader.inputs['Metallic'].default_value=metallic
    shader.inputs['Emission Color'].default_value=(*rgb(color),1)
    shader.inputs['Emission Strength'].default_value=emission
    if family=='sprays':
        image=nd.new('ShaderNodeTexImage')
        image.image=sample_image('sprays-color.png')
        link(image.outputs['Color'],shader.inputs['Base Color'])
        link(image.outputs['Alpha'],shader.inputs['Alpha'])
        material.surface_render_method='DITHERED'
        return material
    if not family: return material
    def image(label,suffix,linear):
        node=nd.new('ShaderNodeTexImage')
        node.label=label
        node.image=sample_image(f'{family}-{suffix}',linear)
        return node
    link(image('Tint and weathering','color.jpg',False).outputs['Color'],shader.inputs['Base Color'])
    tex=image('Occlusion and roughness','orm.png',True)
    if 'glTF Material Output' not in bpy.data.node_groups:
        group=bpy.data.node_groups.new('glTF Material Output','ShaderNodeTree')
        group.interface.new_socket(name='Occlusion',in_out='INPUT',socket_type='NodeSocketFloat')
    ao=nd.new('ShaderNodeGroup')
    ao.node_tree=bpy.data.node_groups['glTF Material Output']
    channels=nd.new('ShaderNodeSeparateColor')
    link(tex.outputs['Color'],channels.inputs['Color'])
    link(channels.outputs['Red'],ao.inputs['Occlusion'])
    link(channels.outputs['Green'],shader.inputs['Roughness'])
    relief=nd.new('ShaderNodeNormalMap')
    relief.inputs['Strength'].default_value=normal
    link(image('Tangent-space relief','normal.jpg',True).outputs['Color'],relief.inputs['Color'])
    link(relief.outputs[0],shader.inputs['Normal'])
    if tiles: material['atlas_cells']=4
    return material

def create_palette(textures, reduced=False):
    global TEXTURES
    TEXTURES=Path(textures)
    definitions={
        'stone':('Honey limestone','e8c7a6',.91,0,'stone',.45),
        'trim':('Carved ivory limestone','f0d2a6',.82,0,'trim',.33),
        'joint':('Deep sandstone and mortar','817480',.94,0,'joint',.36),
        'cliff':('Layered grey sandstone','776976',.95,0,'cliff',.65),
        'top':('Moss, meadow and ochre earth','749346',.97,0,'ground',.42),
        'paving':('Hand-laid courtyard setts','c1a387',.88,0,'floor',.49),
        'roof':('Cobalt glazed slate','27609d',.60,.04,'roof',.55),
        'gold':('Aged hammered gilding','d19c52',.37,.72,'gold',.32),
        'iron':('Oxidised midnight iron','213044',.57,.52,None,.0),
        'wood':('Chestnut oak and timber','573321',.91,0,'wood',.33),
        'glass':('Honey glass','ffb657',.40,.06,None,0),
        'azure_glass':('Luminous azure glass','237dd9',.35,.02,None,0),
        'violet_glass':('Luminous amethyst glass','8c43e9',.42,.03,None,0),
        'lamp':('Amber lantern glass','ffb440',.38,0,None,0),
        'petals':('Orchid and buttercup petals','ffffff',.80,0,None,0),
        'seam':('Shadowed recess','272039',.97,0,None,0),
        'cloth':('Indigo embroidered cloth','254e86',.94,0,'cloth',.24),
        'sprays':('Painted crown sprays','7a8841',.88,0,'sprays',0),
        'leaves':('Foliage atlas','8eab51',.86,0,'leaf',.21),
        'gem':('Cerulean vein crystal','309bea',.33,.16,None,0),
        'wet':('Water, stylized base coat','287aaf',.28,.17,None,0),
        'foam':('Water spray and foam','b8f6f4',.61,0,None,0)
    }
    for key,(name,c,r,m,f,n) in definitions.items():
        PALETTE[key]=surface(name,c,r,m,f,n*.63 if reduced else n,
                             key=='leaves',{'glass':.84,'gem':.29,'foam':.37,'azure_glass':.76,'violet_glass':.44,'lamp':3.00}.get(key,0))

class Craft:
    """Batched by material for the browser, then published into named Blender collections."""
    def __init__(self, name):
        self.name=name
        self.groups=defaultdict(lambda: {'verts':[], 'polys':[], 'uv':[], 'tone':[], 'smooth':[], 'normals':[]})

    def patch(self, mat, points, polys, tone=(1,1,1), uv=None, smooth=False, normals=None):
        chunk=self.groups[mat]
        n=len(chunk['verts'])
        chunk['verts'].extend(points)
        for face in polys:
            verts=[Vector(points[i]) for i in face]
            normal=(verts[1]-verts[0]).cross(verts[2]-verts[0])
            axis=max(range(3),key=lambda i:abs(normal[i]))
            a,b=((1,2),(0,2),(0,1))[axis]
            if uv is None:
                tile={'roof':1.15,'cliff':.62,'top':1.15,'stone':.96,'trim':1.05,'joint':1.02}.get(mat,1.55)
                tex=[(v[a]*tile,v[b]*tile) for v in verts]
            else:
                tex=[uv[i] for i in face]
            chunk['polys'].append(tuple(i+n for i in face))
            chunk['uv'].extend(tex)
            chunk['tone'].extend([(*tone,1)]*len(face))
            chunk['smooth'].append(smooth)
            chunk['normals'].extend([normals[i] if normals else (0,0,0) for i in face])

    def block(self, c, size, mat, bevel=.035, angle=0, tone=(1,1,1)):
        x,y,z=c
        sx,sy,sz=size
        bevel=min(bevel,min(size)*.25)
        ca,sa=cos(angle),sin(angle)
        points=[]
        for h,inset in [(-sz/2,bevel),(-sz/2+bevel,0),(sz/2-bevel,0),(sz/2,bevel)]:
            dx,dy=sx/2-inset,sy/2-inset
            points.extend([(x+ca*a-sa*b,y+sa*a+ca*b,z+h) for a,b in [(-dx,-dy),(dx,-dy),(dx,dy),(-dx,dy)]])
        panels=[(3,2,1,0),(12,13,14,15)]+[(4*k+i,4*k+(i+1)%4,4*(k+1)+(i+1)%4,4*(k+1)+i) for k in range(3) for i in range(4)]
        self.patch(mat,points,panels,tone)

    def solid(self, profile, origin, angle, depth, material, tone=(1,1,1)):
        # Profile runs counterclockwise in the local facade plane.
        x,y,z=origin
        ca,sa=cos(angle),sin(angle)
        n=len(profile)
        points=[(x+u*ca-d*sa,y+u*sa+d*ca,z+v) for d in (0,depth) for u,v in profile]
        polys=[tuple(range(n)),tuple(reversed(range(n,2*n)))]
        polys.extend((i,i+n,(i+1)%n+n,(i+1)%n) for i in range(n))
        self.patch(material,points,polys,tone)

    def rings(self, mat, rings, tone=(1,1,1), smooth=False, cap=True):
        n=len(rings[0])
        points=[point for row in rings for point in row]
        polys=[]
        if cap: polys.append(tuple(reversed(range(n))))
        for j in range(len(rings)-1):
            for i in range(n):
                k=(i+1)%n
                polys.append((j*n+i,j*n+k,(j+1)*n+k,(j+1)*n+i))
        if cap: polys.append(tuple(range(len(points)-n,len(points))))
        self.patch(mat,points,polys,tone,smooth=smooth)

    def taper(self, mat, points, widths, sides=6, tone=(1,1,1)):
        vertices=[]
        for i,(coords,radius) in enumerate(zip(points,widths)):
            center=Vector(coords)
            forward=(Vector(points[min(i+1,len(points)-1)])-Vector(points[max(i-1,0)])).normalized()
            cross=forward.cross(Vector((0,0,1)))
            if cross.length<.02: cross=forward.cross(Vector((1,0,0)))
            cross.normalize()
            up=forward.cross(cross)
            vertices.append([tuple(center+(cross*cos(j*tau/sides)+up*sin(j*tau/sides))*radius) for j in range(sides)])
        self.rings(mat,vertices,tone,smooth=True)

    def objects(self, collection, complete=True):
        for key,data in self.groups.items():
            name=f'{self.name} / {key}'
            mesh=bpy.data.meshes.new(name)
            mesh.from_pydata(data['verts'],[],data['polys'])
            mesh.update()
            mesh.materials.append(PALETTE[key])
            layer=mesh.uv_layers.new(name='UV0')
            layer.data.foreach_set('uv',[v for pair in data['uv'] for v in pair])
            colors=mesh.color_attributes.new(name='Tint and baked contacts',type='FLOAT_COLOR',domain='CORNER')
            # glTF ignores a constant base color hidden behind a MixRGB vertex-color node.
            material=PALETTE[key]
            pigment=material.diffuse_color[:3]
            if not any(node.type=='TEX_IMAGE' for node in material.node_tree.nodes):
                colors.data.foreach_set('color',[v for c in data['tone'] for v in (*[a*b for a,b in zip(c,pigment)],1)])
            else:
                colors.data.foreach_set('color',[v for c in data['tone'] for v in c])
            mesh.color_attributes.active_color=colors
            for poly,flag in zip(mesh.polygons,data['smooth']): poly.use_smooth=flag
            if any(any(n) for n in data['normals']):
                mesh.normals_split_custom_set(data['normals'])
            # Blender uses the vertex data for the offline light pass. glTF records it as COLOR_0.
            material=PALETTE[key]
            if complete and not material.get('vertex_tint'):
                material['vertex_tint']=True
                nodes=material.node_tree.nodes
                shader=nodes.get('Principled BSDF')
                base=shader.inputs['Base Color']
                tex=base.links[0].from_socket if base.is_linked else None
                tint_node=nodes.new('ShaderNodeVertexColor')
                tint_node.layer_name=colors.name
                blend=nodes.new('ShaderNodeMixRGB')
                blend.blend_type='MULTIPLY'; blend.inputs[0].default_value=1
                if tex: material.node_tree.links.new(tex,blend.inputs[1])
                else: blend.inputs[1].default_value=(1,1,1,1)
                material.node_tree.links.new(tint_node.outputs['Color'],blend.inputs[2])
                material.node_tree.links.new(blend.outputs[0],base)
            o=bpy.data.objects.new(name,mesh)
            collection.objects.link(o)
            yield o

def circles(x,y,z, profile,count=12,angle=0,aspect=1):
    return [[(x+r*cos(angle+j*tau/count),y+r*sin(angle+j*tau/count)*aspect,z+h) for j in range(count)] for r,h in profile]

def collection(name, root=None):
    result=bpy.data.collections.new(name)
    (root or bpy.context.scene.collection).children.link(result)
    return result
