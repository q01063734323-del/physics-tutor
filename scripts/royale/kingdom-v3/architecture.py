"""Aether Court: a purpose-built gatehouse, palace, observatory and bridged gardens."""
from math import cos, sin, pi, tau, atan2
from mathutils import Vector
from common import Craft, R, circles

def arch_profile(radius, height, count=14, pointed=.20):
    lower=height-radius
    return [(-radius,0),(radius,0)]+[(radius*cos(pi*i/count),lower+radius*sin(pi*i/count)+pointed*sin(pi*i/count)**5)
                                   for i in range(count+1)]

def opening(g,x,y,z,w,h,angle=0,style='glass'):
    ca,sa=cos(angle),sin(angle)
    def pos(u,v,f=0):return (x+ca*u+sa*f,y+sa*u-ca*f,z+v)
    g.solid(arch_profile(w*1.025,h,pointed=.20*w),pos(0,0,.008),angle,.12,'seam',(.63,.66,.75))
    g.solid(arch_profile(w*.87,h*.89,pointed=.18*w),pos(0,.032,.019),angle,.049,style,(.83,.77,.72))
    if style=='wood':
        for i in range(-3,4):
            u=i*w*.236
            hh=h*.74-abs(i)*w*.035
            g.block(pos(u,hh*.5,.055),(w*.015,.031,hh),'iron',.008,angle)
        for v in [h*.26,h*.59]:
            g.block(pos(0,v,.071),(w*1.57,.048,.030),'iron',.012,angle)
            for i in range(-2,3):
                g.block(pos(i*w*.3,v,.101),(.033,.023,.035),'gold',.008,angle)
        for u in [-.08,.08]:
            p=[pos(u+.043*cos(i*tau/11),h*.34+.055*sin(i*tau/11),.126) for i in range(12)]
            g.taper('gold',p,[.010]*len(p),5)
    else:
        g.block(pos(0,h*.48,.046),(.035,.049,h*.88),'iron',.009,angle)
        g.block(pos(0,h*.41,.051),(w*1.63,.035,.025),'gold',.008,angle)
        g.block(pos(0,-.020,.051),(w*2.48,.18,.083),'trim',.025,angle)
    spring=h-w
    for sign in [-1,1]:
        count=3 if style=='glass' else 5
        for j in range(count):
            v=spring*(j+.5)/count
            g.block(pos(sign*(w+w*.16),v,.042),(w*.32,.18,spring/count-.018),'trim',.021,angle,(.96-j*.015,.95-j*.015,.98))
    for i in range(13):
        a,b=(i+.075)*pi/13,(i+.925)*pi/13
        def curve(r,t): return (r*cos(t),spring+r*sin(t)+w*.20*sin(t)**5)
        profile=[curve(w,b),curve(w,a),curve(w*1.31,a),curve(w*1.31,b)]
        g.solid(profile,pos(0,0,.124),angle,.144,'trim' if i in [5,6,7] else 'stone',
                (.85+i*.009,.82+i*.01,.81+i*.010))
    if style=='wood':
        g.solid([(-.11,0),(.11,0),(.146,.13),(0,.22),(-.146,.13)],pos(0,h+w*.30,.16),angle,.091,'gold')

def mural(g,x,y,z,w,depth,h,angle=0,tiers=0,battlements=False):
    ca,sa=cos(angle),sin(angle)
    def piece(u,d,v,sx,sy,sz,mat,edge=.025,tone=(1,1,1)):
        g.block((x+u*ca-d*sa,y+u*sa+d*ca,v),(sx,sy,sz),mat,edge,angle,tone)
    piece(0,0,z+h/2,w,depth,h,'joint',.055)
    rows=max(3,round(h/.22))
    for k in range(rows):
        n=max(3,int(w/.40))
        span=w/n
        offset=(-.31 if k%2 else .0)*span
        cuts=[-w/2,*[-w/2+q*span+offset+R.uniform(-.045,.045) for q in range(1,n)],w/2]
        frontshade=.73+.27*min(1,k/max(1,rows-3))
        for a,b in zip(cuts,cuts[1:]):
            style=R.uniform(.79,1.0)*frontshade
            piece((a+b)/2,-depth*.51,z+(k+.5)*h/rows,b-a-.017,.14,h/rows-.015,'stone',
                  R.uniform(.015,.03),(style,style*.985,min(1,style*1.04)))
    for k in range(tiers+2):
        v=z+h-.047-k*.067
        base_w=w+(.16 if k==1 else .10)
        piece(0,0,v,base_w,depth+.093,.075,'trim' if k!=2 else 'joint',.024)
    if battlements:
        n=round(w/.31)
        for k in range(n):
            u=(k+.5)*w/n-w/2
            piece(u,0,z+h+.081,w/n*.67,depth*.86,.207,'stone',.035)
            piece(u,0,z+h+.173,w/n*.72,depth*.98,.061,'trim',.021)

def pier(g,x,y,z,h,side=.24,brow=.4):
    shape=[(-side*.73,0),(side*.73,0),(side*.51,h*.44),(side*.5,h),
           (-side*.5,h),(-side*.54,h*.42)]
    g.solid(shape,(x,y-.12,z),0,.28,'stone',(.87,.84,.84))
    for position,w,t in [(0,side*1.64,.14),(.27*h,side*1.42,.075),(.91*h,side*1.48,.081),(h,side*1.66,.095)]:
        g.block((x,y,z+position),(w,brow,t),'trim',.034)
    g.block((x,y,z+h+.115),(side*.57,.16,.22),'trim',.025)

def chapel_roof(g,x,y,z,width,length,h,cathedral=False,low=False):
    # Each side is lofted from a flared carved eave into an asymmetric ridge.
    offsets=[(0,1,.0),(.13,.89,.0),(.29,.75,.02),(.50,.52,.03),(.72,.30,.07),(.89,.12,.09),(1,.015,.10)]
    n=12 if low else 21
    for side in [-1,1]:
        surf=[]
        for i,(v,w,o) in enumerate(offsets):
            row=[]
            for k in range(n+1):
                u=(k/n-.5)*length*(1-.17*v)
                cap=sin(pi*k/n)**2
                row.append((x+side*width*w/2+o,y+u,z+h*v+.065*cap))
            surf.append(row)
        for j,(a,b) in enumerate(zip(surf,surf[1:])):
            for i in range(n):
                face=[a[i],a[i+1],b[i+1],b[i]]
                if side==-1:face.reverse()
                shade=R.uniform(.73,1)*(.92 if j%3==1 else 1)
                tex=[(.11+v[1]*1.03,.27+v[2]*1.2) for v in face]
                g.patch('roof',face,[(0,1,2,3)],(shade,shade,min(1,shade*1.06)),uv=tex)
                if not low and i%2!=j%2:
                    p=Vector(a[i]).lerp(Vector(a[i+1]),.44)
                    edge=.04 if j%2 else .056
                    g.block(tuple(p),(.047,edge,.018),'roof',.004,tone=(.84,.94,1))
        for pos in [0,-1]:
            g.taper('gold',[row[pos] for row in surf],[.036,.034,.031,.029,.027,.024,.020],5)
        g.taper('trim',surf[0][::3]+[surf[0][-1]] if n%3 else surf[0][::3],[.048]*(len(surf[0][::3])+(1 if n%3 else 0)),6)
    ridge=[(x+.1,y+length*(i/10-.5)*.85,z+h+sin(pi*i/10)*.08) for i in range(11)]
    g.taper('gold',ridge,[.045]*11,6)
    if cathedral:
        outlines={side:[(side*width*w*.491+o,v*h-.024) for v,w,o in offsets] for side in [-1,1]}
        profile=[*outlines[1],*list(reversed(outlines[-1]))]
        facade=y-length*.502
        g.solid(profile,(x,facade,z),0,.24,'stone',(.80,.80,.86))
        g.taper('trim',[(x+u,facade-.044,z+v) for u,v in profile],[.061]*len(profile),6)
        g.taper('gold',[(x+u*.91,facade-.065,z+v*.93+.024) for u,v in profile],[.022]*len(profile),5)
        g.block((x,facade-.063,z+.021),(width*.97,.091,.11),'trim',.032)
        # A recessed rose window and mullions fill the visible gable.
        center=(x+.075,facade-.078,z+h*.46)
        radius=min(h*.228,width*.15)
        def disc(r):
            return [(r*cos(i*tau/24),r*sin(i*tau/24)) for i in range(24)]
        g.solid(disc(radius*1.27),center,0,.075,'trim')
        g.solid(disc(radius*1.04),(center[0],center[1]-.028,center[2]),0,.071,'seam')
        g.solid(disc(radius*.88),(center[0],center[1]-.039,center[2]),0,.067,'cloth')
        for i in range(8):
            a=i*tau/8
            q=[(center[0]+radius*.81*cos(a),center[1]-.076,center[2]+radius*.81*sin(a)),
               (center[0]+radius*.41*cos(a+.15),center[1]-.090,center[2]+radius*.41*sin(a+.15)),
               (center[0],center[1]-.094,center[2])]
            g.taper('gold',q,[.017,.014,.010],5)
        g.solid(disc(radius*.18),(center[0],center[1]-.101,center[2]),0,.05,'gem')
        for sign in [-1,1]:
            opening(g,x+sign*width*.185,facade-.038,z+.07,width*.036,h*.22)
        if not low:
            for k in range(2):
                v=z+h*(.082+.082*k)
                for j in range(-2,3):
                    w=width*.156
                    g.block((x+j*w,facade-.022,v),(w*.86,.064,.065),'trim',.013)

def round_roof(g,x,y,z,r,h,variant,low):
    sizes=[(1,0),(1.09,.065),(1.05,.135),(.92,.25),(.75,.42),(.56,.60),(.36,.77),(.17,.91),(.028,1)]
    sides=12 if low else 20
    angular=pi/sides-pi/2
    profile=[(r*a,h*b) for a,b in sizes]
    raw=circles(x,y,z,profile,sides,angular,.92 if variant==1 else 1)
    rings=[[(a+height*height*(.18 if variant==1 else -.05),b,c) for a,b,c in row] for row,(_,height) in zip(raw,sizes)]
    for j,(u,v) in enumerate(zip(rings,rings[1:])):
        for i in range(sides):
            k=(i+1)%sides
            color=R.uniform(.67,1)*(.76 if i==0 else 1)
            pts=[u[i],u[k],v[k],v[i]]
            g.patch('roof',pts,[(0,1,2,3)],(color,min(1,color*1.06),min(1,color*1.16)),
                    [(i*.18,j*.23),(i*.18+.18,j*.23),(i*.18+.18,j*.23+.24),(i*.18,j*.23+.24)])
            if not low and j<6:
                start=Vector(u[i]).lerp(Vector(u[k]),.10)
                end=Vector(u[i]).lerp(Vector(u[k]),.91)
                dv=Vector((x-start.x,y-start.y,0)).normalized()*-.028
                g.patch('roof',[tuple(start),tuple(end),tuple(end+dv+Vector((0,0,-.028))),tuple(start+dv+Vector((0,0,-.028)))],
                        [(3,2,1,0)],(.49,.61,.82))
    for i in range(0,sides,max(3,sides//4)):
        path=[(a,b,c+.018) for a,b,c in [row[i] for row in rings]]
        g.taper('gold',path,[.033-.0022*j for j in range(len(path))],5)
    tip=(x+(.18 if variant==1 else -.05),y,z+h)
    g.rings('gold',circles(*tip,[(.064,-.04),(.086,.032),(.036,.111),(.024,.25),(.005,.34)],9))
    return tip

def bastion(g,x,y,z,w,d,h,roof_h,side,style,low):
    # Each tower type has a different massing and a unique roof profile.
    if style=='belvedere':
        g.rings('stone',circles(x,y,z,[(w*.70,0),(w*.73,.13),(w*.61,.24),(w*.52,h-.16),(w*.69,h),(w*.72,h+.08)],10,pi/10,.81))
        for v in [.16,.55,.87]:
            r=w*(.66-v*.13)
            g.rings('trim',circles(x,y,z+v*h,[(r,-.028),(r+.028,.034),(r,.083)],10,pi/10,.81))
        for dx in [-.20,.20]:
            opening(g,x+dx,y-w*.405,z+.47*h,w*.115,h*.39)
        for i in range(7):
            a=i*tau/7
            g.taper('trim',[(x+w*.53*cos(a),y+w*.43*sin(a),z+h),(x+w*.53*cos(a),y+w*.43*sin(a),z+h+.43)],[.047,.034],6)
        g.rings('trim',circles(x,y,z+h+.36,[(w*.62,0),(w*.66,.068)],12,aspect=.84))
        return round_roof(g,x,y,z+h+.38,w*.60,roof_h,1,low)
    mural(g,x,y,z,w,d,h,tiers=2)
    for dx in [-w*.41,w*.41]:
        pier(g,x+dx,y-d*.52,z,h*.93,.12 if style=='flank' else .19)
    if style=='keep':
        for row in [.24,.59]:
            for u in [-.27,.27]:
                opening(g,x+u,y-d*.55,z+h*row,w*.117,h*.239)
        g.block((x,y,z+h+.06),(w*1.13,d*1.09,.16),'trim',.053)
        chapel_roof(g,x,y,z+h+.16,w*1.25,d*1.28,roof_h,True,low)
        for sign in [-1,1]:
            px=x+sign*w*.48
            g.rings('trim',circles(px,y+.24,z+h+.03,[(.11,0),(.13,.06),(.09,.35)],7))
            g.rings('gold',circles(px,y+.24,z+h+.37,[(.081,0),(.032,.12),(.003,.25)],7))
        return (x+.10,y,z+h+roof_h+.14)
    opening(g,x,y-d*.55,z+h*.37,w*.19,h*.42)
    g.block((x,y,z+h+.05),(w*1.11,d*1.12,.147),'trim',.046)
    return round_roof(g,x,y,z+h+.135,w*.72,roof_h,side,low)

def crest(g,x,y,z,s):
    raw=[(-.44,.66),(.44,.66),(.38,.14),(.24,-.13),(0,-.31),(-.24,-.13),(-.38,.14)]
    poly=[(a*s,b*s) for a,b in reversed(raw)]
    g.solid(poly,(x,y,z),0,.06,'gold')
    g.solid([(a*.84,b*.89+.02*s) for a,b in poly],(x,y-.022,z+.012*s),0,.06,'cloth')
    atom=[]
    for twist in [0,1.047,2.094]:
        atom=[(x+s*(.263*cos(a)*cos(twist)-.091*sin(a)*sin(twist)),y-.051,z+s*(.21+.263*cos(a)*sin(twist)+.091*sin(a)*cos(twist))) for a in [i*tau/26 for i in range(27)]]
        g.taper('gold',atom,[.012*s]*len(atom),4)
    g.rings('gem',circles(x,y-.059,z+.16*s,[(.001,0),(.040*s,.047*s),(.001,.103*s)],6))

def balcony(g,x,y,z,width):
    g.block((x,y+.08,z),(width,.54,.15),'trim',.051)
    for q in [-.46,-.17,.17,.46]:
        g.solid([(-.080,0),(.080,0),(.047,.22),(-.049,.22)],(x+width*q,y-.11,z-.35),0,.20,'stone')
    for i in range(8):
        q=(i/7-.5)*width*.94
        g.taper('trim',[(x+q,y-.194,z+.07),(x+q,y-.194,z+.19),(x+q,y-.194,z+.31)],[.046,.032,.043],6)
    g.block((x,y-.192,z+.32),(width,.087,.063),'gold',.023)

def garden(g,x,y,z,r):
    for mat,profile in [('joint',[(r*1.10,0),(r*1.10,.065),(r*.96,.13)]),
                        ('trim',[(r,0),(r,.103),(r*.92,.148),(r*.79,.142)]),
                        ('wet',[(r*.81,.078),(r*.81,.085)])]:
        g.rings(mat,circles(x,y,z,profile,13))
    g.rings('trim',circles(x,y,z,[(.12,.09),(.095,.19),(.060,.31),(.127,.346),(.15,.391),(.106,.40)],12))
    g.rings('gem',circles(x,y,z+.36,[(.015,0),(.076,.1),(.0,.25)],6))

def build_palace(low=False):
    g=Craft('Aether Court • Architecture')
    # The keep is stepped into the highest terrace and moved off the gateway axis.
    a=bastion(g,-.74,.81,.57,1.66,1.34,3.81,1.59,0,'keep',low)
    b=bastion(g,.97,1.06,.52,1.25,1.27,2.98,1.31,1,'belvedere',low)
    c=bastion(g,-2.08,.28,.43,1.01,.91,2.45,1.27,1,'flank',low)
    d=bastion(g,2.23,-.08,.36,1.04,1.03,1.82,1.05,0,'flank',low)
    e=bastion(g,1.92,1.86,.31,.84,.85,2.35,1.14,1,'belvedere',low)

    mural(g,-.27,-.23,.53,2.68,1.42,2.32,tiers=2)
    chapel_roof(g,-.28,-.39,2.87,2.97,1.46,1.27,True,low)
    for dx in [-1.28,-.77,-.23,.32,.88]:
        opening(g,dx,-.94,1.81,.137,.83)
    balcony(g,-.23,-.97,1.84,2.64)
    for x in [-1.52,1.07]:
        pier(g,x,-.99,.65,1.76,.24,.44)

    # Faceted buttressed gatehouse with a separate shifted porch.
    mural(g,.38,-1.14,.38,2.31,1.08,1.33,tiers=2,battlements=True)
    gate=.48
    opening(g, gate,-1.76,.51,.43,.90,style='wood')
    crest(g,gate,-1.78,1.56,.40)
    for x in [-.39,1.33]:
        pier(g,x,-1.68,.39,1.02,.17,.30)
    for j in range(6):
        z=.47-j*.044
        g.block((gate,-1.79-j*.17,z),(1.15+j*.19,.34,.18),'paving',.044)
        for sign in [-1,1]:
            g.block((gate+sign*(.64+j*.082),-1.84-j*.17,z+.082),(.144,.38,.154),'trim',.026,sign*.24)

    # Defensive arcade on the right and a lower linked observatory terrace.
    for j in range(4):
        x=1.53+j*.37
        pier(g,x,-1.23,.32,.65,.13)
        opening(g,x,-1.19,.46,.105,.45)
    g.block((2.10,-1.24,1.08),(1.64,.25,.14),'trim',.028)
    mural(g,-2.34,-.73,.31,1.08,.25,.64,angle=.54,battlements=True)
    mural(g,2.83,.64,.29,1.45,.26,.60,angle=pi/2,battlements=True)
    mural(g,-2.82,1.1,.36,1.26,.23,.71,angle=pi/2,battlements=True)

    # Polychrome stone approach, retaining walls and blade-like planter corners.
    for i in range(5):
        for j in range(9):
            x=(i-2)*.34+.48+R.uniform(-.038,.038)
            y=-2.29-j*.143
            v=.27-.013*j
            g.block((x,y,v),(.30,.165,.068),'paving',.018,R.uniform(-.11,.11),
                    (R.uniform(.76,1),R.uniform(.79,.99),R.uniform(.81,.99)))
    for x,y,z,angle in [(-2.10,-2.21,.23,.37),(2.54,-2.11,.21,-.51),(-3.04,-.12,.28,-.65)]:
        mural(g,x,y,z,1.33,.32,.46,angle,1,True)
    garden(g,-1.51,-1.86,.31,.435)
    garden(g,2.21,-1.79,.26,.32)
    crest(g,-.84,-.98,2.28,.34)
    crest(g,1.92,-1.44,.76,.24)

    # A sloped timber bridge crosses to the foregarden ledge. Feet are embedded in both crags.
    for j in range(13):
        u=j/12
        x=-3.24-u*2.17
        y=-.41-u*1.54
        z=.30-.50*u+.16*sin(pi*u)
        g.block((x,y,z),(.239,.65,.086),'wood',.025,.63,
                (R.uniform(.77,1),R.uniform(.80,1),.95))
        if j%3==0:
            for sign in [-1,1]:
                g.block((x+sign*.18,y-sign*.27,z+.12),(.074,.075,.31),'wood',.017,.63)
    for sign in [-1,1]:
        branch=[(-3.24-u*2.17+sign*.18,-.41-u*1.54-sign*.27,.52-.50*u+.01*sin(pi*u)) for u in [i/12 for i in range(13)]]
        g.taper('gold',branch,[.018]*13,5)
    flags=[(*a,1.28),(*b,.94),(*c,.88),(*d,.74),(*e,.68)]
    return g,flags
