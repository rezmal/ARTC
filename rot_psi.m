function Cr=rot_psi(C,psi)
% rotate the elastic stiffness matrix around the x1 axis
%
% Copyright 2016 Reza Malehmir
%   Licensed under the Apache License, Version 2.0 (the "License");
%   you may not use this file except in compliance with the License.
%   You may obtain a copy of the License at
%       http://www.apache.org/licenses/LICENSE-2.0
%   Unless required by applicable law or agreed to in writing, software
%   distributed under the License is distributed on an "AS IS" BASIS,
%   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
%   See the License for the specific language governing permissions and
%   limitations under the License.

a11=cosd(psi);  a12=0;  a13=sind(psi);
a21=0;          a22=1; a23=0;
a31=-sind(psi); a32=0; a33=cosd(psi);


M=[a11^2    a12^2   a13^2   2*a12*a13   2*a13*a11   2*a11*a12;
   a21^2    a22^2   a23^2   2*a22*a23   2*a23*a12   2*a21*a22;
   a31^2    a32^2   a33^2   2*a32*a33   2*a33*a31   2*a31*a32;
   a21*a31  a22*a32  a23*a33  a22*a33+a23*a32   a21*a33+a23*a31   a22*a31+a21*a32;
   a31*a11  a32*a12  a33*a13  a12*a33+a13*a32   a13*a31+a11*a33   a11*a32+a12*a31;
   a11*a21  a12*a22  a13*a23  a12*a23+a13*a22   a31*a21+a11*a23   a11*a22+a12*a21];

Cr=M*C*M';
