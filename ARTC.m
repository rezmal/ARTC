function OUT=ARTC(ctop,rotop,cbot,robot,k,inc,azi)
%function out=myreflectivitycode(ctop,rotop,cbot,robot,k,inc,azi)
% out=rpp rps1 rps2
% myreflectivitycode calculates Velocity, amplitude and angles of
% reflected and refracted waves in general anisotropic media
%Given Elastic Stiffness Matrix, azi and inc and type of incident wave
%type (k)
% INCIDENT WAVE type
% k=1 Pwave;
% k=2 qS1 wave;
% k=3 qS2 wave;
% ctop: elastic paramter on the top of layer boundary (GPa)
% rotop: density at the top of layer boundary (gr/cc);
% cbot: Elastic stiffness matrix at the bottom of layer boundary (GPa);
% robot: density matrix at the bottom of the boundary(gr/cc);
% inc: Inclination angle for incident wave;
% azi: Azimuth of incident wave arrival;
%
% Derived solution is came from CHrisstoffel-Kelvin Equation for
% General anisotropic material, used literature for this code are as follows (but not limited to)
%
% for more information and theory please refer to submitted paper to
% Computer and Geoscience:
% Malehmir, R. and Douglas Schmitt, 2015, ARTC: Anisotropic Reflectivity
% Calculator, Computer and Geoscience, Elsevier. 
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


format long
%% %%%%%%%%%%%%%%%%%% finding the velocity of I wave %%%%%%%%%%%%%%

n = Nfinder(inc,azi)'; 
nR = zeros(3);
nT = nR;
ctop=CC(ctop);cbot=CC(cbot);
[vel,pol] = chrisKel(n(1),n(2),n(3),ctop,rotop); % QC passed for VTI 
% INCIDENT WAVE INFORMATION VEl and POL
PI = pol(:,k);% for P-wave incident angle
s  = n./vel(k);
SI = s';
%% %%%%%%%%%%%%%%%%%%%%% finding the direction of Generated waves
% slowness of Reflected wave-modes
s3_R = ChrstKel_RT(ctop./rotop,s(1),s(2));% find slowness for Reflected wave
s3_R = abs(real(s3_R))+1i * abs(imag(s3_R));
SR   = [s(1) s(1) s(1)
        s(2) s(2) s(2)
        s3_R(1) s3_R(2) s3_R(3)];
% slowness of TRANSMITTED wave-modes
% it is multiplied to by -1 to remind us it is going downward
s3_T =  ChrstKel_RT(cbot./robot,s(1),s(2));% find slowness for transmitted wave
s3_T = -abs(real(s3_T))-1i*abs(imag(s3_T)); 
ST = [s(1)      s(1)        s(1)
      s(2)      s(2)        s(2)
      s3_T(1)   s3_T(2)     s3_T(3)];
  
for pp=1:3 % for each resulted raypath
    nR(:,pp) = SR(:,pp)./norm(SR(:,pp),2);
    nT(:,pp) = ST(:,pp)./norm(ST(:,pp),2);
    [vRi(:,pp),polR{pp}] = chrisKel(nR(1,pp),nR(2,pp),nR(3,pp),ctop,rotop);
    [vTi(:,pp),polT{pp}] = chrisKel(nT(1,pp),nT(2,pp),nT(3,pp),cbot,robot); %lower boundary
end
%% REFLECTED VELOCITY POLARIZATION ANGLES
vR(1,1) = vRi(1,1); %qP wave velocity
vR(2,1) = vRi(2,2); %qS1 wave velocity
vR(3,1) = vRi(3,3); %qS2 wave velocity
PR(1:3,1) = polR{1}(:,1);% REFLECTED qP wave polarization
PR(1:3,2) = polR{2}(:,2);% REFLECTED qS1 wave polarization
PR(1:3,3) = polR{3}(:,3);% REFLECTED  qS2 wave polarization
%% TRANSMITTED VELOCITY POLARIZATION ANGLES
vT(1,1) = vTi(1,1); %qP wave velocity
vT(2,1) = vTi(2,2); %qS1 wave velocity
vT(3,1) = vTi(3,3); %qS2 wave velocity
PT(1:3,1) = polT{1}(:,1);% TRANSMITTED qP wave polarization
PT(1:3,2) = polT{2}(:,2);% TRANSMITTED qS1 wave polarization
PT(1:3,3) = polT{3}(:,3);% TRANSMITTED qS2 wave polarization

%  angle of generated waves
for i=1:3
    [incR(i,1),aziR(i,1)]=anglefinder(nR(:,i));
    [incT(i,1),aziT(i,1)]=anglefinder(nT(:,i));
end
%% Calculation of Amplitude Ratio
% Creating boundary condition matrix
%tic;[mat,B]=bmatrix(ctop,cbot,SI,SR,ST,PI,PR,PT);toc;
RR = boundary_condition(ctop,cbot,PI,SI,PR,SR,PT,ST);

SlR = [norm(SR(:,1));norm(SR(:,2));norm(SR(:,3))];
SlT = [norm(ST(:,1));norm(ST(:,2));norm(ST(:,3))];
SI = [norm(SI(:,1));norm(SI(:,2));norm(SI(:,3))];
phase=atan(-imag(RR)./real(RR));
%% USE this for REFLECTIVITY GUI
OUT=[SlR SlT (RR(1:3)) (RR(4:6)) phase(1:3,1) phase(4:6,1) incR incT 1./vel' pol PR];
