%% for Reflected/Transmitted waves
%given s1 and s2 we want to find s3 for reflected or transmited wavess
function s33=ChrstKel_RT(c,s1,s2)
% c : density normalized stiffness matrix
% flag : 1 for reflection
%        2 for refraction
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

s12 = s1^2; 
s22 = s2^2;
s1s2_2 = 2*s1*s2; 
s1s2 = s1*s2;

% coefficients of S3^2
T11(1) = c(5,5);  
T22(1) = c(4,4);
T33(1) = c(3,3);
T23(1) = c(3,4);
T13(1) = c(3,5);
T12(1) = c(4,5);
% coefficients of S3^1
T11(2) = 2*s1 * c(1,5)          + 2*s2 * c(5,6);  
T22(2) = 2*s1 * c(4,6)          + 2*s2 * c(2,4);
T33(2) = 2*s1 * c(3,5)          + 2*s2 * c(3,4);
T13(2) =   s1 * (c(1,3)+c(5,5)) +   s2 * (c(3,6)+c(4,5));
T12(2) =   s1 * (c(1,4)+c(5,6)) +   s2 * (c(2,5)+c(4,6));
T23(2) =   s1 * (c(3,6)+c(4,5)) +   s2 * (c(2,3)+c(4,4));
% coefficients of S3^0
T11(3) = s12 * c(1,1) + s22 * c(6,6) + s1s2_2 * c(1,6) -1;% s3^0
T22(3) = s12 * c(6,6) + s22 * c(2,2) + s1s2_2 * c(2,6) -1;
T33(3) = s12 * c(5,5) + s22 * c(4,4) + s1s2_2 * c(4,5) -1;
T23(3) = s12 * c(5,6) + s22 * c(2,4) + s1s2 * (c(2,5)+c(4,6));
T13(3) = s12 * c(1,5) + s22 * c(4,6) + s1s2 * (c(1,4)+c(5,6));
T12(3) = s12 * c(1,6) + s22 * c(2,6) + s1s2 * (c(1,2)+c(6,6));
 
% making sixth degree equation for s3
% convolutino is used for polynomial multiplication
P = conv(T11,(conv(T22,T33)-conv(T23,T23)))-conv(T12,(conv(T12,T33)-conv(T13,T23)))+conv(T13,(conv(T12,T23)-conv(T13,T22)));
%% converting sixth degree eqation simpler polynomial Eq 
s33 =  (sort(((sqrt(roots(P(1:2:end)))))));
if length(s33) < 3
 s33(2:3) = 1e4;
end
