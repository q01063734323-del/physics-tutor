"""Hand-placed ornament, climbing plants and erosion features for the existing citadel."""
from math import cos, sin, pi, tau
from random import Random
from mathutils import Vector

from common import Craft, circles


def flourish(g, x, y, z, scale, sign):
    points = [(x+scale*t*sign, y, z+scale*(.44*sin(t*pi)+.19*t)) for t in (i/16 for i in range(17))]
    g.taper('gold', points, [.013*scale+.002]*16+[.003], 5, (.87,.74,.60))
    for j in range(2, 7):
        a = j/7
        x0 = x+scale*a*sign
        z0 = z+scale*(.44*sin(a*pi)+.19*a)
        for flip in (-1,1):
            vertices = [(x0,y,z0),(x0+.052*sign*scale,y-.016,z0+flip*scale*.076),
                        (x0+.17*sign*scale,y-.004,z0+flip*scale*.16),
                        (x0+.139*sign*scale,y+.006,z0+flip*scale*.065)]
            g.patch('gold', vertices, [(0,1,2,3),(3,2,1,0)], (.88,.75,.59))


def branch_leaf(g, start, direction, length, width, tone):
    base=Vector(start)
    along=Vector(direction).normalized()
    across=along.cross(Vector((0,1,.22))).normalized()
    tip=base+along*length
    mid=base.lerp(tip,.45)
    center=mid+Vector((0,-width*.24,width*.18))
    points=[base, mid+across*width, tip, mid-across*width*.82, center]
    g.patch('leaves', [tuple(p) for p in points],
            [(0,1,4),(1,2,4),(2,3,4),(3,0,4),(4,1,0),(4,2,1),(4,3,2),(4,0,3)],tone,
            [(.29,.07),(.12,.27),(.30,.44),(.43,.27),(.29,.27)],smooth=True)


def climbing_vine(g, origin, height, variant, ultra):
    x,y,z=origin
    rng=Random(422+variant)
    path=[(x+.08*sin(i*.61+variant),y+.03*cos(i*.55),z+height*i/16) for i in range(17)]
    g.taper('wood',path,[.018*(1-i/20)+.004 for i in range(17)],5,(.62,.72,.46))
    for i in range(1,16,1 if ultra else 2):
        for sign in (-1,1):
            dx=sign*(.26+.55*rng.random())
            length=rng.uniform(.09,.18)
            branch_leaf(g,path[i],(dx,-.24,.30+rng.random()),length,length*.38,
                        rng.choice([(.67,.79,.48),(.47,.69,.34),(.74,.82,.48)]))


def architectural_finish(g, low, ultra):
    # Raised oak panels follow the existing arch, with hand-forged hinges at the jambs.
    for side in (-1,1):
        dx=.48+side*.18
        g.solid([(-.129,0),(.129,0),(.129,.32),(0,.41),(-.129,.32)],
                (dx,-1.827,.59),0,.018,'wood',(.74,.61,.51))
        for z in (.70,.98):
            points=[(dx+side*u, z+v) for u,v in [(0,.027),(.12,.053),(.20,.038),(.24,.0),(.20,-.038),(.12,-.049),(0,-.027)]]
            g.solid([(x-dx,v-z) for x,v in (points if side<0 else list(reversed(points)))],(dx,-1.896,z),0,.035,
                    'iron',(.69,.78,.91))
            for pos in (dx+.075*side,dx+.168*side):
                g.rings('gold',circles(pos,-1.906,z,[(.012,-.012),(.016,.0),(.011,.012)],6),(.90,.75,.58))
        flourish(g,dx-.081,-1.858,.82,.16,1)
        if not low:
            flourish(g,dx+.067,-1.855,.85,.13,-1)
        # Distinct carved blocks across the visible riser, with alternating joints.
        for step in range(6):
            z=.47-step*.044+.056
            for n in range(3 if low else 4):
                u=(n+.46+.12*(step%2))*(.16+step*.016)
                g.block((.48+side*u,-1.968-step*.17,z),(.150+step*.015,.043,.063),'trim',.012,
                        tone=(.73+.054*n,.71+.050*n,.75+.041*n))
    for side in (-1,1):
        x=-.28+side*.93
        for row in (1.90,2.64):
            flourish(g,x,-1.005,row,.23,side)
        x=.48+side*.89
        g.rings('trim',circles(x,-1.83,.53,[(.104,0),(.104,.074),(.069,.126),(.063,.70),(.091,.76),(.12,.80)],10))
        g.rings('gold',circles(x,-1.83,.53,[(.081,.123),(.094,.138),(.077,.157)],10))
        g.rings('gold',circles(x,-1.83,.53,[(.086,.699),(.102,.735),(.081,.752)],10))
    for i,p in enumerate([(-1.66,-1.05,.37),(1.09,-1.005,.58),(2.63,-.78,.27),(-2.46,-.73,.29)]):
        climbing_vine(g,p,[1.54,1.28,.65,.86][i],i,ultra)
    if not low:
        for (left,right,y,z,height) in [(-2.49,-1.91,-.86,2.22,.83),(1.85,2.35,-.86,1.79,.63)]:
            g.taper('gold',[(left-.056,y,z),(right+.056,y,z)],[.025,.025],8)
            u=(left+right)/2
            for material,inset,offset in [('gold',0.,.0),('cloth',.046,-.018)]:
                a,b=left+inset,right-inset
                outline=[(a-u,0),(b-u,0),(b-u,-height*.79),(0,-height+inset),(a-u,-height*.79)]
                g.solid(list(reversed(outline)),(u,y+offset,z-inset),0,.045,material)
            for angle in (0,pi/3,2*pi/3):
                points=[(u+.164*cos(t)*cos(angle)-.052*sin(t)*sin(angle),y-.046,z-height*.44+
                         .164*cos(t)*sin(angle)+.052*sin(t)*cos(angle)) for t in [i*tau/20 for i in range(21)]]
                g.taper('gold',points,[.010]*21,5)


def terrain_finish(low, ultra):
    cliff=Craft('Eroded cliff • exposed shelves and shaded grotto')
    plants=Craft('Fern beds • exposed roots and moss')
    rng=Random(79104)
    for i,(cx,cy,cz,scale) in enumerate([(-2.96,-2.23,-1.0,.78),(-1.43,-2.63,-1.22,.71),
                                      (1.26,-2.54,-1.05,1.1),(3.58,-1.92,-.99,.81),(-3.62,-1.64,-1.24,.63)]):
        # Warped ledges with stone grain following the strata and chipped exposed edges.
        for row in range(3 if low else (6 if ultra else 4)):
            z=cz+(row-1.7)*.27
            x=cx+.21*sin(row*1.6+i)
            y=cy-.18*cos(row*.7+i)
            w=scale*rng.uniform(.49,.83)
            shape=[(-w*.40,0),(-w*.51,.075),(-w*.26,.19),(w*.20,.161),(w*.51,.08),
                   (w*.54,-.072),(w*.18,-.16),(-w*.31,-.13)]
            profile=[(u,v+rng.uniform(-.022,.022)) for u,v in shape]
            g=[(x+u,y-.10+abs(u)*.32,z+v) for u,v in profile]
            rim=[(px+(px-x)*.09,py+.13,pz+.022) for px,py,pz in g]
            cliff.patch('cliff',g+rim,[tuple(reversed(range(8)))]+[(j,(j+1)%8,(j+1)%8+8,j+8) for j in range(8)],
                        (.70+row*.052,.66+row*.043,.74+row*.043))
            for sprig in range(2 if ultra else 1):
                j=(sprig*3+row)%5
                p=rim[j]
                branch_leaf(plants,(p[0],p[1]-.06,p[2]+.04),(.27,-.19,.38),.16,.049,(.58,.76,.38))
        if i in (1,2,3):
            path=[(cx+.18*sin(q*.59+i),cy-.26,cz+.48-q*.12) for q in range(8)]
            plants.taper('wood',path,[.032*(1-q/9) for q in range(8)],5,(.63,.65,.48))
            for q in (2,4,6):
                branch_leaf(plants,path[q],((1 if q%3 else -1),-.25,-.37),.16,.038,(.65,.80,.41))
    # A deep rock shelter under the approach, with uneven side jambs and a recessed floor.
    cx,cy,cz=1.19,-2.61,-.52
    outline=[(-.34,-.36),(.32,-.36),(.35,-.13),(.26,.095),(.045,.224),(-.12,.193),(-.272,.05),(-.34,-.13)]
    cliff.solid(outline,(cx,cy,cz),0,.14,'seam',(.68,.55,.76))
    ring=[(x*1.32,z*1.30) for x,z in outline]
    for j in range(2,len(outline)):
        k=(j+1)%len(outline)
        cliff.solid([outline[j],outline[k],ring[k],ring[j]],(cx,cy-.044,cz),0,.17,'cliff',
                    (.70,.68,.78))
    for x,y,z in [(-2.72,-2.16,.28),(-1.55,-2.71,.29),(1.79,-2.66,.24),(3.16,-1.82,.28),(-3.52,-1.65,.29),
                  *([(-1.94,-1.98,.24),(2.16,-1.92,.27),(3.41,-.94,.32)] if ultra else [])]:
        for arm in range(5 if low else 8):
            a=arm*2.399
            length=rng.uniform(.24,.45)
            path=[(x+cos(a)*t*length,y+sin(a)*t*length,z+.21*sin(t*pi*.78)) for t in (0,.25,.49,.74,1)]
            plants.taper('leaves',path,[.010,.009,.008,.006,.002],4,(.67,.91,.48))
            for j in range(1,4):
                for sign in (-1,1):
                    l=.115*(1-j/5)
                    d=(cos(a)*.35-sin(a)*sign,sin(a)*.35+cos(a)*sign,.17)
                    branch_leaf(plants,path[j],d,l,l*.24,(.63+j*.05,.86+j*.025,.49))
    return cliff, plants
