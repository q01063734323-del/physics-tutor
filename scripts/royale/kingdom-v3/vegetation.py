"""Five branching silhouettes and companion understory assets sharing one foliage atlas."""
from math import sin, cos, pi, tau
from mathutils import Vector
import random
from common import Craft

SPECIES=[
    ('Canopy oak', 1.66, .68, .13, 0, .17, 8, .2),
    ('Wind-cut pine', 1.82, .52, .08, 1, .19, 7, .85),
    ('Ember maple', 1.37, .69, .087, 2, -.24, 7, .48),
    ('Silver birch', 1.66, .45, .063, 3, .27, 5, .64),
    ('Hanging willow', 1.44, .66, .094, 1, -.20, 7, .23),
]

def atlas(cell, u, v):
    return (.5*(cell%2)+.028+u*.444,.5*(cell//2)+.028+v*.444)

def leaf(g,p,d,length,width,cell,shade=1):
    a=Vector(p)
    t=Vector(d).normalized()
    cross=t.cross(Vector((0,0,1)))
    if cross.length<.1: cross=t.cross(Vector((1,0,0)))
    cross.normalize()
    normal=cross.cross(t).normalized()
    points=[a,a+t*length*.42+cross*width*.58,
            a+t*length*.93+normal*width*.18,a+t*length*.42-cross*width*.57,
            a+t*length*.47+normal*width*.26]
    g.patch('leaves',[tuple(q) for q in points],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],(shade,shade,min(1,shade*1.07)),
            [atlas(cell,u,v) for u,v in [(.50,.10),(.12,.53),(.51,.89),(.88,.53),(.51,.56)]])

def clump(g,c,radii,cell,rng,kind,low):
    zvals=[-.63,-.33,.03,.38,.71,.91]
    shape=[.22,.72,1.0,.88,.56,.21]
    if kind==1: shape=[.29,.94,.78,.61,.34,.095]
    cx,cy,cz=c; sx,sy,sz=radii
    n=7 if low else 12
    rings=[]
    phase=rng.random()*tau
    for j,(radius,h) in enumerate(zip(shape,zvals)):
        row=[]
        for i in range(n):
            a=phase+i*tau/n+(j%2)*.16
            variation=1+.13*sin(a*3+j*.32)+.11*sin(a*5-j*.32)+rng.uniform(-.075,.075)
            row.append((cx+sx*radius*cos(a)*variation+.09*j*sx,
                        cy+sy*radius*sin(a)*variation,
                        cz+sz*(h+.114*sin(a*4+j)*radius)))
        rings.append(row)
    points=[v for row in rings for v in row]
    for j in range(len(rings)-1):
        shade=(.63+.080*j)*rng.uniform(.91,1.04)
        if kind==1:shade*=.93
        for i in range(n):
            k=(i+1)%n
            face=[rings[j][i],rings[j][k],rings[j+1][k],rings[j+1][i]]
            uv=[atlas(cell,.20+i%2*.21,.18+j*.11),atlas(cell,.72,.18+j*.11),
                atlas(cell,.72,.18+(j+1)*.12),atlas(cell,.19,.18+(j+1)*.12)]
            g.patch('leaves',face,[(0,1,2,3)],(shade,min(1,shade*1.11),shade*.87),uv,smooth=True)
    g.patch('leaves',rings[-1],[tuple(range(n))],(.93,.95,.88),
            [atlas(cell,.5+.31*cos(tau*i/n),.5+.31*sin(tau*i/n)) for i in range(n)],smooth=True)
    g.patch('leaves',rings[0],[tuple(reversed(range(n)))],(.49,.56,.45),
            [atlas(cell,.5+.31*cos(tau*i/n),.5+.31*sin(tau*i/n)) for i in range(n)],smooth=True)
    for i in range(6 if low else 28):
        angle=phase+i*2.399
        layer=1+i%4
        t=i%n
        base=Vector(rings[layer][t]).lerp(Vector(rings[layer][(t+1)%n]),rng.uniform(.1,.66))
        droop=-.56 if kind==4 else -.31 if kind==1 else .11
        direction=(cos(angle),sin(angle),droop+rng.uniform(-.27,.26))
        length=rng.uniform(.21,.46)*sx
        leaf(g,base,direction,length,length*(.75 if kind!=1 else .48),cell,shade=rng.uniform(.71,1))

def prototype(index,low):
    name,h,w,trunk,cell,bend,n,spread=SPECIES[index]
    rng=random.Random(241+index*421)
    g=Craft(name)
    bark='trim' if index==3 else 'wood'
    stems=[(0,0,0),(bend*.12,-.02,.23*h),(-.045+bend*.41,-.045,.49*h),
           (bend*.66,.04,.73*h),(bend*.90,.025,.97*h),(bend,.02,1.05*h)]
    g.taper(bark,stems,[trunk*1.45,trunk,trunk*.81,trunk*.56,trunk*.37,.012],8 if not low else 5,
            (.55,.48,.45) if bark=='trim' else (.86,.79,.78))
    for j in range(4):
        a=j*tau/4+index*.31
        paths=[(.008,.003,.15),(cos(a)*trunk*1.5,sin(a)*trunk*1.4,.045),
                (cos(a)*trunk*2.8,sin(a)*trunk*2.7,-.015),(cos(a)*trunk*4.3,sin(a)*trunk*4.0,-.057)]
        g.taper('wood',paths,[trunk*.56,trunk*.43,trunk*.24,.007],5,(.63,.53,.55))
    for j in range(n):
        a=.7+j*2.399
        u=j/(n-1)
        foliage=w*(1-(u*.62 if index==1 else u*.33))
        reach=w*(.93+spread*.17)*rng.uniform(.53,1.02)*(1-u*.52)
        x,y,z=cos(a)*reach+bend*u,sin(a)*reach,.44*h+u*.55*h
        if index==2:x-=.08
        cz=z+(.24 if index not in [1,4] else .1)
        lower=(bend*u*.59,-.018,z-h*.19)
        path=[lower,(x*.47,y*.38,z-h*.14),(x*.69,y*.64,z-h*.055),(x,y,cz+.016)]
        g.taper(bark,path,[trunk*(.42-.13*u),trunk*.30,trunk*.17,.008],6,(.80,.74,.70))
        shape=(foliage*rng.uniform(.57,.80),foliage*rng.uniform(.52,.83),foliage*(.54 if index==1 else .65))
        clump(g,(x,y,cz),shape,cell,rng,index,low)
        if not low and index in [0,2,4] and j%2==0:
            clump(g,(x+cos(a)*foliage*.18,y+sin(a)*foliage*.25,cz-.12),
                  tuple(v*.63 for v in shape),cell,rng,index,low)
        if index==4 and j%2==0:
            for q in range(3 if low else 6):
                p=Vector((x+cos(a+q*.44)*shape[0]*.74,y+sin(a+q*.44)*shape[1]*.82,cz-.11))
                for t in range(3):
                    p.z-=.14
                    leaf(g,p,(cos(a+q),sin(a+q),-.94),.19,.066,cell,.74+t*.076)
    if index==1:
        # A mature pine has a layered crown, with open gaps between drooping branch fans.
        for j in range(5):
            weight=1-j*.155
            angle=j*2.399
            z=.67*h+j*.102*h
            cx=bend*(.57+j*.078)+cos(angle)*.09*weight
            cy=sin(angle)*.08
            clump(g,(cx,cy,z),(.53*weight,.46*weight,.32),cell,rng,1,low)
            if not low:
                for k in range(6):
                    a=k*tau/6+angle
                    leaf(g,(cx+cos(a)*weight*.36,cy+sin(a)*weight*.31,z-.08),
                         (cos(a),sin(a),-.68),.22*weight,.074,cell,.77+.022*k)
    return g

def shrub(index,low):
    name=['Juniper pad','Rhododendron','Golden moss cushion'][index]
    rng=random.Random(index+76)
    g=Craft(name)
    for j in range(2 if low else 4):
        a=j*2.399
        clump(g,(cos(a)*.19,sin(a)*.14,.13+.032*j),(.28-j*.013,.21,.22-j*.015),
              [1,3,0][index],rng,0,low)
    if index==1:
        for j in range(5):
            a=j*2.399
            g.rings('foam', [[(cos(a)*.22+.026*cos(i*tau/5),sin(a)*.19+.026*sin(i*tau/5),.22+t*.045) for i in range(5)] for t in [0,1]],(1,.56,.68))
    return g

def groundcover(low):
    g=Craft('Cliff gardens • grass, wildflowers and ivy')
    rng=random.Random(416)
    terrain=[(-3.6,-2.12,.17),(-3.19,-2.57,.15),(-1.9,-3.0,.08),(2.93,-2.01,.16),(3.41,-1.53,.13),(4.15,-.78,.16),
             (-4.18,.22,.19),(-3.26,1.44,.19),(2.95,1.16,.21),(-5.64,-2.06,-.20),(4.89,2.18,.17)]
    terrain.extend([(-2.39,-2.23,.24),(-1.98,-2.86,.16),(-.86,-2.88,.13),
                    (1.78,-2.51,.22),(2.39,-2.54,.19),(3.30,-1.87,.16),(-5.08,-2.10,-.14)])
    for cx,cy,cz in terrain:
        for j in range(9 if low else 27):
            a=rng.random()*tau
            p=(cx+rng.uniform(-.32,.32),cy+rng.uniform(-.38,.38),cz)
            length=rng.uniform(.13,.29)
            for k in range(3 if low else 5):
                leaf(g,p,(cos(a+k),sin(a+k),rng.uniform(.6,1.8)),length,.068,k%2,
                     rng.uniform(.60,.95))
        for j in range(3 if low else 9):
            x=cx+rng.uniform(-.26,.26)
            y=cy+rng.uniform(-.21,.21)
            g.taper('wood',[(x,y,cz),(x+.025,y,cz+.15),(x,y,cz+.24)],[.01,.008,.004],4,(.53,.72,.38))
            for k in range(5):
                a=k*tau/5
                pts=[(x,y,cz+.245),(x+.05*cos(a+.35),y+.05*sin(a+.35),cz+.254),
                     (x+.073*cos(a),y+.073*sin(a),cz+.274),(x+.05*cos(a-.35),y+.05*sin(a-.35),cz+.254)]
                g.patch('petals',pts,[(0,1,2,3)],[(.72,.22,.62),(.43,.28,.87),(.94,.69,.21)][j%3])
    ivy=[(-3.3,-2.54,.26,1.39),(3.14,-2.46,.27,1.63),(4.18,-1.21,.21,1.31),
         (-4.30,-.81,.21,1.41),(1.33,-1.82,1.15,.68),(-1.54,-1.04,1.45,.76)]
    for x,y,z,h in ivy:
        path=[(x+.15*sin(i*.51),y-.12*sin(i*.26),z-i*h/13) for i in range(14)]
        g.taper('wood',path,[.017-i*.0007 for i in range(14)],5,(.65,.78,.46))
        for i,(a,b,c) in enumerate(path):
            for side in [-1,1]:
                leaf(g,(a,b-.019,c),(side*.83,-.28,-.52),.16 if i<9 else .12,.15,
                     (i%3)//2,.67+.011*i)
    return g
