function [vel,pol]=chrisKel(n1,n2,n3,c,ro)
% phase = 1 P-wave
% phase = 2 SV or S1 fast
% phase = 3 SH or S2 slow
% testing params
% [c,ro]=stiff('iso');
% n=Nfinder(0,0);
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
n=[n1 n2 n3];
%% for incident wave
n1_2 = n1^2;  
n2_2 = n2^2;  
n3_2 = n3^2;
n2n3_2 = 2*n2*n3; 
n2n3 = n2*n3;
n3n1_2 = 2*n3*n1; 
n3n1 = n3*n1;   
n1n2_2 = 2*n1*n2; 
n1n2 = n1*n2;

T11 = n1_2 * c(1,1) + n2_2 * c(6,6) + n3_2 * c(5,5) + n2n3_2 * c(5,6)            + n3n1_2 * c(1,5)            + n1n2_2 * c(1,6);
T22 = n1_2 * c(6,6) + n2_2 * c(2,2) + n3_2 * c(4,4) + n2n3_2 * c(2,4)            + n3n1_2 * c(4,6)            + n1n2_2 * c(2,6);
T33 = n1_2 * c(5,5) + n2_2 * c(4,4) + n3_2 * c(3,3) + n2n3_2 * c(3,4)            + n3n1_2 * c(3,5)            + n1n2_2 * c(4,5);
T23 = n1_2 * c(5,6) + n2_2 * c(2,4) + n3_2 * c(3,4) + n2n3   * (c(2,3) + c(4,4)) + n3n1   * (c(3,6) + c(4,5)) + n1n2   * (c(2,5) + c(4,6));
T13 = n1_2 * c(1,5) + n2_2 * c(4,6) + n3_2 * c(3,5) + n2n3   * (c(3,6) + c(4,5)) + n3n1   * (c(1,3) + c(5,5)) + n1n2   * (c(1,4) + c(5,6));
T12 = n1_2 * c(1,6) + n2_2 * c(2,6) + n3_2 * c(4,5) + n2n3   * (c(2,5) + c(4,6)) + n3n1   * (c(1,4) + c(5,6)) + n1n2   * (c(1,2) + c(6,6));


T = [T11 T12 T13;	 T12 T22 T23;	 T13 T23 T33];
 
 
[pol,ev] = eigs(T);
ev(ev<1e-5)=0;
vel = sqrt(diag(ev)/ro); % sorted velocity

     %% chekcing Pwave polarity
            if n*pol(:,3) < 0
              
                pol(:,3) = -pol(:,3) ;
                %fprintf('reversed')
             end
             ps1=pol(:,2); vs1=vel(2);
             ps2=pol(:,1); vs2=vel(1);
             pp=pol(:,3); vp=vel(3);

%            picking right shear velocity and polarization
            if n(1)==0 && n(2)==0
                vel=[ vp vs1 vs2];
                pol=[ pp ps1 ps2];
            end
%             else
%                 nplane=cross([0 0 n(3)],[n(1) n(2) 0]);
% %                in theory the normal to the plane of the P and N
% %               should be SH and SV should be in the plane of the P and N
%                 if norm(cross(nplane,(pol(:,1)))) < norm(cross(nplane,(pol(:,2))))
%                     psv=pol(:,1); vsv=vel(1);
%                     psh=pol(:,2); vsh=vel(2);
%                 %    disp('sv=1')
%                 elseif norm(cross(nplane,(pol(:,1)))) > norm(cross(nplane,(pol(:,2))))
%                     psv=pol(:,2);vsv=vel(2);
%                     psh=pol(:,1);vsh=vel(1);
%                  %                      disp('sv=2')
% 
%                 else % numerical issue
%                     psv=pol(:,1); vsv=vel(1);
%                     psh=pol(:,2); vsh=vel(2);
%                   %  disp('!')
                
                
                vel=[vp vs1 vs2];
                pol=[pp ps1 ps2];
              end
            






