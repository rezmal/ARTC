 function [in,az]=anglefinder(n)
% n is vector of [n1 n2 n3] in x1 x2 x3 coordinate sytem
% clc
% inc=20;
% azi=271;
% n=Nfinder(inc,azi);
% n=[ 0.612372435695794   0.353553390593274   0.707106781186547]
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

N=norm(n,2);
in=acos(n(3)/N)*180/pi;
if in >90
in=in-180;
end
az=atan2(n(2),n(1));
az=az*180/pi;
if az<0
    az=az+360;
end
