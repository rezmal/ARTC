function R=boundary_condition(cu,cl,pi,si,pr,sr,pt,st)
%% Contunity of displacement
% uI+uR=uT > uI = - uR + uT 
% u=A
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

DIS = [-pr(1,1) -pr(1,2) -pr(1,3) pt(1,1) pt(1,2) pt(1,3);
       -pr(2,1) -pr(2,2) -pr(2,3) pt(2,1) pt(2,2) pt(2,3);
       -pr(3,1) -pr(3,2) -pr(3,3) pt(3,1) pt(3,2) pt(3,3)];
% incident wave
 DIS0 = pi;
%% conservation of traction force on the surface

for i=1:3 % for reflected waves
    T3_R(:,i) = traction3(cu,pr(:,i),sr(:,i));% for reflected waves
    T3_T(:,i) = traction3(cl,pt(:,i),st(:,i));% for transmitted waves
end
% incident wave
T3_0 = traction3(cu,pi,si);

%% forming the BC matrix form equations

G = [  DIS; -T3_R T3_T];
I = [ DIS0;  T3_0];
%R = inv(G)*I;
R = (G'*G+1e-5*eye(6))\(G'*I);% avoiding singularity





