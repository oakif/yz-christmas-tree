from turtle import *
from random import *
import math


# 绘图方法
def Rightdraw(Range, Fd, Right):
    for i in range(Range):  # Range循环次数
        fd(Fd)  # 向前Fd个距离
        right(Right)  # 在当前行进方向再向右偏转Right度


def Leftdraw(Range, Fd, Left):
    for i in range(Range):  # Range循环次数
        fd(Fd)  # 向前Fd个距离
        left(Left)  # 在当前行进方向再向右偏转Right度


# 背景改为黑色
screensize(bg='black')


# 重设海龟位置
def changeMypos(x, y, range=heading(), Fd=0):
    penup()
    goto(x, y)
    seth(range)
    fd(Fd)
    pendown()


def drawBranch(x, y, size=1):
    changeMypos(x, y)
    Leftdraw(6, 3, 9)
    seth(0)
    Rightdraw(6, 3, 9)
    seth(0)
    fd(6)


# 画五角星
def drawStar(x, y, Range, size):
    pensize(1)
    color('red', 'yellow')
    begin_fill()
    changeMypos(x, y, Range)
    for i in range(5):  # 画五角星
        forward(10 * size)
        right(144)  # 五角星的角度
        forward(10 * size)
        left(72)  # 继续换角度
    end_fill()
    right(126)


# 绘制雪花
def drawSnow():
    hideturtle()
    speed(0)
    pencolor('white')
    pensize(2)
    for i in range(80):  # 雪花数量
        changeMypos(randint(-248, 248), randint(-100, 248))
        petalNumber = 6  # 雪花花瓣数为6
        snowSize = int(randint(2, 10))
        for j in range(petalNumber):
            fd(snowSize)
            backward(snowSize)
            right(360 / petalNumber)


# 圣诞袜子
def drawSock(x, y, range, size=1):
    # 绘制袜子的白边
    pensize(1)
    changeMypos(x, y, range)
    color('black', 'white')
    begin_fill()
    fd(20 * size)
    circle(3 * size, 180)
    fd(20 * size)
    circle(3 * size, 180)
    end_fill()
    # 绘制袜子的下半部分
    color('white', 'red')
    begin_fill()
    startx = x + 2 * size * math.cos(math.radians(range))
    starty = y + 2 * size * math.sin(math.radians(range))
    finalx = x + 18 * size * (math.cos(math.radians(range)))
    finaly = y + 18 * size * (math.sin(math.radians(range)))
    changeMypos(startx, starty, range - 90)
    fd(20 * size)  # 圆弧距离白边40
    seth(180 + range)
    fd(5 * size)  # 向袜子头延伸10
    circle(7 * size, 180)  # 袜子头处的半圆形
    fd(21 * size)  # 袜子宽42
    seth(90 + range)
    d = distance(finalx, finaly)  # 找到袜子底部与白边的距离
    fd(d)
    seth(range + 180)
    fd(16 * size)
    end_fill()


# 圣诞帽
def drawHat(x, y, range, size=1):
    # 绘制帽白边
    pensize(1)
    changeMypos(x, y, range)
    color('white', 'white')
    begin_fill()
    fd(20 * size)
    circle(-3 * size, 180)
    fd(20 * size)
    circle(-3 * size, 180)
    end_fill()
    # 绘制帽子上半部分
    color('white', 'red')
    begin_fill()
    startx = x + 2 * size * math.cos(math.radians(range))
    starty = y + 2 * size * math.sin(math.radians(range))
    finalx = x + 18 * size * (math.cos(math.radians(range)))
    finaly = y + 18 * size * (math.sin(math.radians(range)))
    changeMypos(startx, starty, range + 90)
    Rightdraw(18, 2 * size, 7)
    seth(190)
    Leftdraw(9, 2 * size, 8)
    goto(finalx, finaly)
    goto(startx, starty)
    end_fill()
    # 绘制圣诞帽上的小球
    changeMypos(startx, starty, range + 90)
    Rightdraw(18, 2 * size, 7)
    begin_fill()
    color('white', 'white')
    circle(-2.5 * size)
    end_fill()


# 绘制彩带
def drawRibbon(x, y, range, size):
    begin_fill()
    color('red', 'red')
    seth(range + 40)
    fd(15 * size * math.tan(math.radians(range + 40)))
    seth(range + 90)
    fd(20 / 3 * size)
    seth(range - 140)
    fd(15 * size * math.tan(math.radians(range + 40)))
    seth(range - 90)
    fd(20 / 3 * size)
    end_fill()


# 圣诞糖果
def drawCandy(x, y, range, size):
    # 绘制糖体
    pensize(1)
    changeMypos(x, y, range)
    color('white', 'white')
    begin_fill()
    startx = x + 2 * size * math.cos(math.radians(range))
    starty = y + 2 * size * math.sin(math.radians(range))
    finalx = x + 8 * size * (math.cos(math.radians(range)))
    finaly = y + 8 * size * (math.sin(math.radians(range)))
    changeMypos(startx, starty, range + 90, 40 * size)
    circle(-40 / 3 * size, 180)
    circle(-8 / 3 * size, 180)
    circle(22 / 3 * size, 180)
    goto(finalx, finaly)
    goto(startx, starty)
    end_fill()
    # 绘制下面三条彩带
    color('white')
    changeMypos(startx, starty, range + 90)
    fd(10 / 3 * size)
    drawRibbon(xcor(), ycor(), range, size)
    changeMypos(xcor(), ycor(), range + 90, 13.3 * size)
    drawRibbon(xcor(), ycor(), range, size)
    changeMypos(xcor(), ycor(), range + 90, 13.3 * size)
    drawRibbon(xcor(), ycor(), range, size)
    # 绘制弧线段的彩带
    changeMypos(startx, starty, range + 90, 40 * size)
    circle(-13.3 * size, 55)
    x1 = xcor()
    y1 = ycor()
    begin_fill()
    circle(-13.3 * size, 80)
    right(75)
    fd(6.3 * size)
    right(115)
    circle(7 * size, 85)
    goto(x1, y1)
    end_fill()


setup(500, 500, startx=None, starty=None)
title('Merry Christmas')
speed(0)
pencolor('green')
pensize(10)
hideturtle()
changeMypos(0, 185, 0)

# 树顶层
seth(-120)
Rightdraw(10, 12, 2)
changeMypos(0, 185, -60)
Leftdraw(10, 12, 2)
changeMypos(xcor(), ycor(), -150, 10)
# 第一层的波浪
for i in range(4):
    Rightdraw(5, 7, 15)
    seth(-150)
    penup()
    fd(2)
    pendown()
# 二层
changeMypos(-55, 70, -120)
Rightdraw(10, 8, 5)
changeMypos(50, 73, -60)
Leftdraw(10, 8, 5)
changeMypos(xcor(), ycor(), -120, 10)
seth(-145)
pendown()
# 第二层的波浪
for i in range(5):
    Rightdraw(5, 9, 15)
    seth(-152.5)
    penup()
    fd(3)
    pendown()
# 树三层
changeMypos(-100, 0, -120)
Rightdraw(10, 6.5, 4.5)
changeMypos(80, 0, -50)
Leftdraw(10, 6, 3)
changeMypos(xcor(), ycor(), -120, 10)
seth(-145)
# 第三次的波浪
for i in range(6):
    Rightdraw(5, 9, 15)
    seth(-152)
    penup()
    fd(3)
    pendown()
# 树四层
changeMypos(-120, -55, -130)
Rightdraw(7, 10, 4)
changeMypos(100, -55, -50)
Leftdraw(7, 10, 5)
changeMypos(xcor(), ycor(), -120, 10)
seth(-155)
# 第四层的波浪
for i in range(7):
    Rightdraw(5, 9, 13)
    seth(-155)
    penup()
    fd(3)
    pendown()
# 树根
changeMypos(-70, -120, -85)
Leftdraw(3, 8, 3)
changeMypos(70, -120, -95)
Rightdraw(3, 8, 3)
changeMypos(xcor(), ycor(), -170, 10)
Rightdraw(10, 12, 2)
# 画树枝
drawBranch(45, -80)
drawBranch(-70, -25)
drawBranch(-20, 40)

# 添加挂件
drawHat(-25, 175, -10, 2.5)
drawCandy(-75, -50, -10, 1)
drawCandy(10, 40, -10, 1.2)
drawStar(110, -90, 80, 1)
drawStar(-120, -100, 50, 1)
drawStar(-90, -50, 20, 1)
drawStar(90, -25, 30, 1)
drawSock(10, -35, -10, 2)
drawSock(-40, 100, 10, 1)
drawStar(-20, 40, 30, 1)
drawStar(10, 120, 90, 1)

# 打印祝福语
color('dark red', 'red')  # 定义字体颜色
penup()
goto(0, -230)
write(
    'Merry Christmas', align='center', font=('Comic Sans MS', 40, 'bold')
)  # 定义文字、位置、字体、大小

# 调用下雪的函数
drawSnow()
done()
