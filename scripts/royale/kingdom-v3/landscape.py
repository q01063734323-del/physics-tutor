"""Eroded rock forms, strata and terrain anchors shared with the live environment."""
from math import sin,cos,pi,tau,sqrt,atan2
from mathutils import Vector
import random

from common import Craft, circles
from architecture import distant_keep

FALLS=[
    (-2.34,-2.75,.26,1.20,4.1,-.08),
    (2.66,-2.50,.31,1.32,4.56,.18),
    (-4.19,-1.00,.21,.63,2.61,-1.02),
    (4.11,-.62,.22,.59,3.03,1.1),
    (-5.54,-2.62,-.18,.56,2.12,-.11),
    (-8.25,4.86,1.63,.30,2.60,-.12),(8.52,6.29,2.15,.39,2.85,-.08)
]
LEDGES=[
    (-5.16,-1.84,-.12,1.51,1.18,2.50,2),
    (5.91,1.08,-.64,1.47,1.28,2.86,1),
    (-8.4,5.8,1.64,1.59,1.25,3.22,0),
    (8.66,7.2,2.15,2.10,1.42,3.72,2),
    (-8.1,-5.8,-3.00,2.33,1.45,2.89,1),
    (8.3,-5.19,-3.58,1.89,1.52,3.7,0),
    (7.6,12.6,3.15,.72,.65,1.75,1)
]

def outline(a, variant):
    return 1+.12*sin(3*a+.52*variant)+.071*cos(5*a-variant*.42)+.039*sin(9*a-.23)

def sculpt_island(g,center,sizes,variant,low):
    cx,cy,cz=center
    sx,sy,depth=sizes
    sides=29 if low else 55
    rows=[(1.0,0),(.999,-.072),(.94,-.17),(.87,-.26),(.78,-.40),(.71,-.55),(.52,-.70),(.30,-.89),(.11,-1.03)]
    verts=[]
    ring_uv=[]
    for j,(r,h) in enumerate(rows):
        ring=[]; uv=[]
        for i in range(sides):
            a=i*tau/sides
            angle=a+.033*sin(j*.65+i*.75)
            mask=outline(a,variant)
            cut=.09*cos(12*a+.57*j)+.04*sin(21*a-.25*j)
            shift=(1-r)*sin(2.3*variant+.6)*.48
            rr=r*(mask+(cut if j else cut*.28))
            x=cx+sx*(rr*cos(angle)+shift)
            y=cy+sy*(rr*sin(angle)+.096*(1-r)*cos(variant))
            z=cz+depth*(h+.026*sin(a*4+j*.29)+.015*cos(a*9-j*.16))
            ring.append((x,y,z))
            uv.append((i/sides*sx*2.22, -z*.43+.15*sin(i*.72)+.06*cos(i*1.41)))
        verts.append(ring);ring_uv.append(uv)
    for j in range(len(verts)-1):
        a,b=verts[j:j+2]
        for i in range(sides):
            n=(i+1)%sides
            avg=(i+.5)*tau/sides
            split=sin(avg*2.7+j*.41)*.091+cos(avg*13+j*.38)*.04
            shade=[.84,.88,.78,.87,.74,.77,.67,.61][j]+split
            points=[a[i],b[i],b[n],a[n]]
            tex=[ring_uv[j][i],ring_uv[j+1][i],ring_uv[j+1][n],ring_uv[j][n]]
            if n==0:
                tex=[(tex[k][0]+(sx*2.22 if k in [2,3] else 0),tex[k][1]) for k in range(4)]
            mat='top' if j==0 and (i+variant)%9 not in [2,3] else 'cliff'
            g.patch(mat,points,[(0,1,2),(0,2,3)],(shade*.96,shade,min(1,shade*1.11)),uv=tex)
    ring=verts[0]
    midpoint=(cx,cy,cz+.02)
    verts_inner=[(cx+(x-cx)*.58,cy+(y-cy)*.58,cz+.03+(.05*sin(i*.42))) for i,(x,y,z) in enumerate(ring)]
    for i in range(sides):
        n=(i+1)%sides
        l=.77+.15*sin(i*.6)**2
        g.patch('top',[ring[i],ring[n],verts_inner[n],verts_inner[i],midpoint],[(0,1,2,3),(3,2,4)],(l,l,min(l*.94,1)))
    g.patch('cliff',verts[-1],[tuple(reversed(range(sides)))],(.48,.53,.71))

def outcrop(g,center,size,variant,shade=1, moss=True):
    x,y,z=center
    sx,sy,sz=size
    n=7
    layers=[(-.94,.17),(-.68,.69),(-.22,1.0),(.24,.83),(.64,.58),(.90,.25)]
    rng=random.Random(891+variant*431)
    base=[(i*tau/n+rng.uniform(-.1,.10),rng.uniform(.75,1.2)) for i in range(n)]
    profile=[]
    for j,(height,r) in enumerate(layers):
        profile.append([(x+sx*(cos(a)*r*factor+.12*j-.20),y+sy*(sin(a)*r*factor+.06*j-.12),
                         z+sz*(height+.13*cos(a*2.2+variant)+rng.uniform(-.071,.071))) for a,factor in base])
    for j,(a,b) in enumerate(zip(profile,profile[1:])):
        for i in range(n):
            k=(i+1)%n
            l=(.65+.12*j)*rng.uniform(.77,1.09)*shade
            mat='top' if j==4 and moss and i%3==0 else 'cliff'
            g.patch(mat,[a[i],a[k],b[k],b[i]],[(0,1,2),(0,2,3)],(l*.94,l,min(1,l*1.12)))
    g.patch('top' if moss else 'cliff',profile[-1],[tuple(range(n))],(.81,.86,.76))

def crystal(g,c,r,height,lean,theme=0):
    x,y,z=c
    n=6
    layers=[(.22,0),(.80,.13),(1,.36),(.65,.86),(.012,1)]
    rings=[[(x+r*rr*cos(j*tau/n+pi/6)+h*lean,
             y+r*rr*sin(j*tau/n+pi/6)+h*lean*.14,z+h*height+.11*r*sin(j*tau/n)) for j in range(n)]
           for rr,h in layers]
    for q,(a,b) in enumerate(zip(rings,rings[1:])):
        for j in range(n):
            k=(j+1)%n
            shade=(.41+.097*((j+2*q)%6))
            tone=(shade*.68, min(1,shade*(.96 if theme==0 else .74)),min(1,shade*1.65))
            g.patch('gem',[a[j],a[k],b[k],b[j]],[(0,1,2,3)],tone)

def make_landscape(low):
    main=Craft('Geology • terraces, strata and aether veins')
    sculpt_island(main,(0,0,.235),(4.46,3.14,4.52),0,low)
    rng=random.Random(166)
    for j in range(21 if low else 39):
        a=(j+.33)*tau/(21 if low else 39)
        w=rng.uniform(.75,.97)
        x,y=cos(a)*4.39*w,sin(a)*3.14*w
        depth=1 if j%7==5 else rng.uniform(.65,1.32)
        outcrop(main,(x,y,-rng.uniform(.85,1.85)),(rng.uniform(.35,.83),rng.uniform(.35,.82),depth),j%11,rng.uniform(.77,1.09))
    for k,(x,y,z,sx,sz) in enumerate([(-2.97,-2.19,-.83,.33,1.04),(-1.42,-2.92,-1.19,.37,.90),
                                     (.92,-2.90,-1.01,.31,1.12),(2.06,-2.64,-1.28,.32,.86),
                                     (3.40,-1.98,-1.01,.31,1.19),(-4.08,-.99,-1.12,.29,.94)]):
        outcrop(main,(x,y,z),(sx,.29,sz),17+k,.84,True)
    for i,(x,y,z,r,s) in enumerate([(-3.72,-1.64,-1.34,.37,.87),(3.91,-1.65,-1.36,.41,1.41),
                                     (-1.70,-2.52,-2.46,.34,.96),(3.27,-2.31,-2.38,.33,.98),
                                     (3.80,.9,-.65,.27,.71),(-5.53,-2.10,-.62,.17,.61)]):
        outcrop(main,(x,y+.12,z),(.48,.30,.60),i,.66,False)
        for j in range(2 if low else 4):
            crystal(main,(x+(j-1)*r*.56,y-abs(j-1)*.089-.30,z-.21+j*.11),r*(1-.16*j),s*(1-.14*j),.37*(j-1.4))
    satellites=[]
    for i,(x,y,z,sx,sy,depth,v) in enumerate(LEDGES):
        if low and i in [4,6]: continue
        g=Craft(['West bridge garden','East granite isle','Distant west cliffs','Distant citadel rock','Foreground west ledge','Foreground east ledge','High distant spire'][i])
        sculpt_island(g,(x,y,z),(sx,sy,depth),v+1,low)
        for j in range(3 if low else 6):
            a=j*2.399
            outcrop(g,(x+sx*.74*cos(a),y+sy*.73*sin(a),z-.55-j*.13),(sx*.32,sy*.29,.61+j*.07),i+j,.78)
        satellites.append(g)
    for n,(x,y,z,scale) in enumerate([(-8.63,5.95,1.66,1.02),(8.47,7.16,2.19,1.24),(5.98,1.45,-.62,.72)]):
        satellites.append(distant_keep(x,y,z,scale,n))
    shoreline=Craft('Creeks • pool and spillway beds')
    for x,y,z,width,height,angle in FALLS:
        path=[(x+sin(angle)*d,y-cos(angle)*d,z+.016*cos(d*2.5)) for d in [-.87,-.46,-.12,.0,.18]]
        for i,((a,b,c),(e,f,g)) in enumerate(zip(path,path[1:])):
            w=width*(.52-.027*i)
            points=[(a-w*cos(angle),b-w*sin(angle),c),(e-w*cos(angle),f-w*sin(angle),g),
                    (e+w*cos(angle),f+w*sin(angle),g),(a+w*cos(angle),b+w*sin(angle),c)]
            shoreline.patch('wet',points,[(0,1,2,3)],(.56+i*.088,.62+i*.086,.82+i*.04))
        for direction in [-1,1]:
            q=direction*width*.51
            for j in range(5):
                px=x+q*cos(angle)-sin(angle)*(.63-j*.15)
                py=y+q*sin(angle)+cos(angle)*(.63-j*.15)
                outcrop(shoreline,(px,py,z+.032),(.12,.17,.112),j,1,j%3==1)
    return main,satellites,shoreline

def demo_water():
    g=Craft('Water • spillway curtains, wet channels and foam')
    for x,y,z,w,h,a in FALLS:
        count=15
        for q in range(3):
            scale=[.99,.70,.43][q]
            points=[];uv=[]
            for j in range(count+1):
                v=j/count
                wrap=.34*(v/.22 if v<.22 else 1)+.20*v*v
                for i in range(12):
                    u=i/11
                    local=(u-.5)*w*scale*(.86+.31*v)
                    curve=.16*(.5-abs(u-.5))+.15*sin(v*11+i*.21)*.13
                    points.append((x+local*cos(a)+sin(a)*(wrap+q*.044),
                                   y+local*sin(a)-cos(a)*(wrap+q*.044+curve),
                                   z-h*v**1.29+q*.014))
                    uv.append((u,v))
            for j in range(count):
                for i in range(11):
                    n=j*12+i
                    sheen=.43+.29*sin(i*.87+j*.22)**2+.18*cos(i*3.25+q+j*.42)**4
                    g.patch('wet',points[n:n+2]+points[n+12:n+14],[(0,2,3,1)],
                            (.38+sheen*.34,.66+sheen*.26,.82+sheen*.15),[uv[k] for k in [n,n+1,n+12,n+13]],smooth=True)
        for j in range(19):
            t=j*2.399
            rr=.045+(j%7)*.019
            px=x+.61*w*cos(t)*(j/19)+sin(a)*.38
            py=y-.43-cos(a)*.17+sin(t)*.29
            pz=z-h+.13*sin(j*.42)
            r=rr*.58
            g.rings('foam',circles(px,py,pz,[(r*.17,-r),(r,0),(r*.3,r*.8)],5),(.64,.76,.80))
    return g
