function [n] = Nfinder(inc,azi)
% function [n] = Nfinder(inc, azi)
% change signe of n3 for myreflectivity code
% wave is travelling form the upper boundary to the lowe boundary, so n3 is
% negative for the incident wave
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

if inc==0
    n=[ 0 0 -1];
else
    n1 = sind(inc) * cosd(azi);
    n2 = sind(inc) * sind(azi);
    n3 = -cosd(inc);
    n = [n1 n2 n3];% downgoing wave is negative
    n = n./norm(n,2);% normalizing
end

