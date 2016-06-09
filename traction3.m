function T3j= traction3 (C,p,s)
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

% calculate normale traction force assuming the interface is horizontal
% EPS3= [S33,S32 S31]'
p1 = p(1); p2 = p(2); p3 = p(3);
k1 = s(1); k2 = s(2); k3 = s(3);
ps33 = [p1*k1 ; p2*k2  ;  p3*k3 ; (p2*k3 + p3*k2) ; (p3*k1 + p1*k3) ; (p1*k2 + p2*k1)];
T3j = C(3:5,:) * ps33;
end     
