% % run_artc.m
clear,clc,close all
% ct = isoC(4,2);
% cb = isoC(4.41,2.205);
% rt = 2.;
% rb = 2.;
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

[ct,rt]=stiff('water');
[cb,rb]=stiff('ort');
k = 1;
inc = 0:0.5:90;
azi = 1;
ci = 0;
ca = 0;
for a = azi
    ci = 0;
    ca = ca+1;
    for i = inc
        ci = ci+1;
        out = ARTC(ct,rt,cb,rb,k,i,a);
        r(ci,ca,:) = out(:,3);
    end
end

%% P
subplot(2,1,1)
plot(inc,real(r(:,:,1)),'k'),hold on
plot(inc,imag(r(:,:,1)),'k--')
%% S1
subplot(2,1,2)
plot(inc,real(r(:,:,2)),'k'),hold on
plot(inc,imag(r(:,:,2)),'k--')
%% S2
plot(inc,real(r(:,:,3)),'k'),hold on
plot(inc,imag(r(:,:,3)),'k--')

